// Opt-in localhost + real Supabase test. Only this run's synthetic requests are removed.
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import postgres from 'postgres';
import { chromium } from 'playwright-core';
import { issueInvitation } from '../server/invitation-issuer.mjs';

const require = createRequire(import.meta.url);
const fixture = require('./fixtures/commercial.cjs');
const engine = require('../public/journey-calculation.js');
const target = new URL(process.env.AOC_TEST_BASE_URL || 'http://localhost:5173');
assert.ok(target.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(target.hostname), 'Database/UI trial must target localhost only.');
const baseURL = target.origin;
const sql = postgres(process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING, { prepare: false, max: 1, connect_timeout: 15, ssl: 'require' });
const company = 'Manual Trial ' + randomUUID();
const name = 'Synthetic Manual Access Test';
const executablePath = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(path => path && existsSync(path));
let browser;
let debugPage;
let stage = 'initial status';
const payload = { area: fixture.area, confirmed: true, answers: Object.fromEntries(Object.entries(fixture).filter(([key]) => !['area', 'process_confirmed'].includes(key))) };
const cookieHeader = cookies => cookies.map(cookie => cookie.name + '=' + cookie.value).join('; ');
try {
  const status = await (await fetch(baseURL + '/api/access/status', { signal: AbortSignal.timeout(8000) })).json();
  assert.equal(status.manualApproval, true, 'Start npm run dev:access:review before the manual trial test.');
  browser = await chromium.launch({ executablePath, headless: true });
  for (const width of [1440, 390]) {
    stage = `request form (${width}px)`;
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    debugPage = page;
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'Request access to the AI Commerce estimator' }).waitFor();
    assert.equal(await page.locator('input').count(), 5);
    await page.getByRole('button', { name: 'Request access', exact: true }).click();
    assert.equal(await page.getByRole('heading', { name: 'Request received' }).count(), 0, 'Blank form must stay on required inputs.');
    // Deliberately use the former allowlist address: manual mode must NOT grant access.
    const profile = { name, company, website: 'example.com', role: 'Synthetic tester', businessEmail: 'local-test@example.com' };
    for (const [field, value] of Object.entries(profile)) await page.locator('#access-' + field).fill(value);
    await page.route('**/api/access/verify', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Synthetic save failure; please retry.' }) }));
    await page.getByRole('button', { name: 'Request access', exact: true }).click();
    await page.getByRole('alert').waitFor();
    assert.equal(await page.getByLabel('Your name').inputValue(), name);
    assert.equal(await page.getByRole('heading', { name: 'Request received' }).count(), 0);
    await page.unroute('**/api/access/verify');
    await page.getByRole('button', { name: 'Request access', exact: true }).click();
    await page.getByRole('heading', { name: 'Request received' }).waitFor();
    const confirmationBoxes = await page.evaluate(() => ['.access-header', '.access-intro__content', '.access-form-panel'].map(selector => {
      const box = document.querySelector(selector).getBoundingClientRect();
      return { left: box.left, right: box.right, width: innerWidth };
    }));
    assert.ok(confirmationBoxes.every(box => box.left >= 0 && box.right <= box.width), 'Confirmation focus must not clip either edge of the layout: ' + JSON.stringify(confirmationBoxes));
    assert.equal(await page.locator('.area').count(), 0);
    assert.equal((await context.cookies()).some(cookie => cookie.name === 'aoc_estimator_review_access'), false);
    const rows = await sql`select * from public.access_requests where company = ${company} and name = ${name} order by created_at desc`;
    const row = rows[0];
    assert.deepEqual([row.name, row.company, row.website, row.role, row.business_email, row.review_status],
      [name, company, 'https://example.com/', profile.role, profile.businessEmail, 'pending']);
    const blocked = await context.request.post(baseURL + '/api/journey/calculate', { headers: { origin: baseURL }, data: payload });
    assert.equal(blocked.status(), 401);
    await assert.rejects(issueInvitation(sql, row.id, { baseURL }), /Approve this request/);
    // This is the simulated AOC review, restricted to this test's newly-created row.
    await sql`update public.access_requests set review_status = 'approved' where id = ${row.id} and company = ${company}`;
    stage = `expired invitation (${width}px)`;
    const expired = await issueInvitation(sql, row.id, { baseURL });
    await sql`update public.access_invitations set expires_at = now() - interval '1 hour' where request_id = ${row.id}`;
    const invitedContext = await browser.newContext({ viewport: { width, height: 900 } });
    const invitedPage = await invitedContext.newPage();
    await invitedPage.goto(expired.url, { waitUntil: 'networkidle' });
    await invitedPage.getByRole('button', { name: 'Open calculator', exact: true }).waitFor();
    assert.equal(new URL(invitedPage.url()).hash, '', 'Invitation secrets are removed from the address bar.');
    assert.equal(await invitedPage.locator('input').count(), 0, 'Invited visitors do not repeat the form.');
    await invitedPage.getByRole('button', { name: 'Open calculator', exact: true }).click();
    await invitedPage.getByRole('alert').waitFor();
    assert.match(await invitedPage.getByRole('alert').textContent(), /expired, already used or no longer approved/);

    const invite = await issueInvitation(sql, row.id, { baseURL });
    stage = `fresh invitation in same tab (${width}px)`;
    await invitedPage.goto(invite.url, { waitUntil: 'networkidle' });
    await invitedPage.getByRole('button', { name: 'Open calculator', exact: true }).waitFor();
    const token = new URLSearchParams(new URL(invite.url).hash.slice(1)).get('access');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    let [stored] = await sql`select token_hash, used_at, session_hash from public.access_invitations where token_hash = ${tokenHash}`;
    assert.equal(stored.used_at, null, 'Opening/scanning the invitation URL must not consume it automatically.');
    assert.notEqual(stored.token_hash, token);
    await invitedPage.getByRole('button', { name: 'Open calculator', exact: true }).click();
    stage = `calculator after invitation (${width}px)`;
    await invitedPage.locator('.area').first().waitFor();
    assert.equal(await invitedPage.locator('.area').count(), 12);
    const sessionCookie = (await invitedContext.cookies()).find(cookie => cookie.name === 'aoc_estimator_review_access');
    assert.equal(sessionCookie.httpOnly, true);
    assert.equal(sessionCookie.sameSite, 'Lax');
    [stored] = await sql`select token_hash, used_at, session_hash from public.access_invitations where token_hash = ${tokenHash}`;
    assert.ok(stored.used_at);
    assert.equal(stored.session_hash, createHash('sha256').update(sessionCookie.value).digest('hex'));
    assert.notEqual(stored.session_hash, sessionCookie.value, 'Only session hashes are stored in the database.');
    const reused = await context.request.post(baseURL + '/api/access/redeem', { headers: { origin: baseURL }, data: { token } });
    assert.equal(reused.status(), 403);
    let result = await invitedContext.request.post(baseURL + '/api/journey/calculate', { headers: { origin: baseURL }, data: payload });
    assert.equal(result.status(), 200);
    assert.deepEqual(await result.json(), { ...engine.calculate(payload), source: 'server' });
    await invitedPage.reload({ waitUntil: 'networkidle' });
    stage = `session reload (${width}px)`;
    await invitedPage.locator('.area').first().waitFor();
    assert.equal(await invitedPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual(await invitedPage.evaluate(() => [Object.keys(localStorage), Object.keys(sessionStorage)]), [[], []]);
    await sql`update public.access_requests set review_status = 'revoked' where id = ${row.id} and company = ${company}`;
    result = await invitedContext.request.post(baseURL + '/api/journey/calculate', { headers: { origin: baseURL }, data: payload });
    assert.equal(result.status(), 401, 'Manual revocation must immediately block existing sessions.');
    await sql`update public.access_requests set review_status = 'approved' where id = ${row.id} and company = ${company}`;
    await sql`update public.access_invitations set session_expires_at = now() - interval '1 hour' where token_hash = ${tokenHash}`;
    result = await invitedContext.request.get(baseURL + '/api/access/status');
    assert.equal((await result.json()).authenticated, false);
    await sql`update public.access_invitations set session_expires_at = now() + interval '1 hour' where token_hash = ${tokenHash}`;
    const copiedCookie = cookieHeader(await invitedContext.cookies());
    stage = `logout (${width}px)`;
    await invitedPage.getByRole('button', { name: 'End session' }).click();
    await invitedPage.getByRole('heading', { name: 'Request access to the AI Commerce estimator' }).waitFor();
    const copiedStatus = await fetch(baseURL + '/api/access/status', { headers: { cookie: copiedCookie } });
    assert.equal((await copiedStatus.json()).authenticated, false, 'A copied cookie must remain logged out.');

    // A real simultaneous redemption must have exactly one winner.
    const race = await issueInvitation(sql, row.id, { baseURL });
    stage = `concurrent redemption (${width}px)`;
    const raceToken = new URLSearchParams(new URL(race.url).hash.slice(1)).get('access');
    const attempts = await Promise.all([1, 2].map(() => fetch(baseURL + '/api/access/redeem', {
      method: 'POST', headers: { origin: baseURL, 'content-type': 'application/json' }, body: JSON.stringify({ token: raceToken }),
    })));
    assert.deepEqual(attempts.map(response => response.status).sort(), [200, 403]);
    await sql`update public.access_requests set review_status = 'declined' where id = ${row.id} and company = ${company}`;
    await assert.rejects(issueInvitation(sql, row.id, { baseURL }), /Approve this request/);
    if (width === 390) await page.screenshot({ path: 'artifacts/manual-access-pending-mobile.png', fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual(errors, []);
    await invitedContext.close();
    await context.close();
    console.log(`PASS: Real manual-review browser/database flow at ${width}px: pending, approval, expired/replayed links, no form repeat, hash-only secrets, concurrent redemption, sessions, revocation, logout and calculator parity.`);
  }
} catch (error) {
  console.error('Manual trial integration failed at ' + stage + ':', error instanceof assert.AssertionError ? error.message : (error.code || error.name));
  if (debugPage && !debugPage.isClosed()) await debugPage.screenshot({ path: 'artifacts/manual-access-regression-error.png', fullPage: true });
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  const removed = await sql`delete from public.access_requests where company = ${company} and name = ${name} returning id`;
  console.log(`Removed ${removed.length} synthetic requests and their related test links only. Existing demonstration/client records preserved.`);
  await sql.end({ timeout: 5 });
}
