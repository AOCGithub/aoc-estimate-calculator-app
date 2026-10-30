// Opt-in integration test: real Supabase + localhost, synthetic records only.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { chromium } from 'playwright-core';
import postgres from 'postgres';

const require = createRequire(import.meta.url);
const fixture = require('./fixtures/commercial.cjs');
const calculation = require('../public/journey-calculation.js');
const baseURL = 'http://localhost:5173';
const connection = process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING;
assert.ok(connection, 'Run through Vercel env run with the connected database.');
const executablePath = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(item => item && existsSync(item));
assert.ok(executablePath, 'An installed Chromium browser is required.');
const sql = postgres(connection, { prepare: false, max: 1, connect_timeout: 15, ssl: 'require' });
const company = 'Synthetic Access ' + randomUUID();
const testName = 'Local Integration Test';
let browser;
try {
  const status = await (await fetch(baseURL + '/api/access/status')).json();
  assert.equal(status.enabled, true);
  assert.equal(status.requestsEnabled, true, 'Start npm run dev:access first.');
  browser = await chromium.launch({ executablePath, headless: true });
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Request access / continue' }).waitFor();
    assert.equal(await page.locator('input').count(), 5);
    const email = 'pending-' + width + '-' + randomUUID() + '@example.com';
    const profile = { name: testName, company, website: 'example.com', role: 'Synthetic tester', businessEmail: email };
    let result = await context.request.post(baseURL + '/api/access/verify', {
      headers: { origin: baseURL }, data: { ...profile, role: '' },
    });
    assert.equal(result.status(), 400);
    let rows = await sql`select id from public.access_requests where company = ${company} and business_email = ${email}`;
    assert.equal(rows.length, 0, 'Invalid answers do not create database records.');
    for (const [id, value] of Object.entries(profile)) await page.locator('#access-' + id).fill(value);
    await page.getByRole('button', { name: 'Request access / continue' }).click();
    await page.getByRole('heading', { name: 'Request received' }).waitFor();
    rows = await sql`select name, company, website, role, business_email, review_status from public.access_requests where company = ${company} and business_email = ${email}`;
    assert.deepEqual(rows.map(row => ({ ...row })), [{ name: testName, company, website: 'https://example.com/', role: profile.role,
      business_email: email, review_status: 'pending' }]);
    assert.equal((await context.cookies()).some(cookie => cookie.name === 'aoc_estimator_access'), false);
    result = await context.request.post(baseURL + '/api/journey/calculate', { headers: { origin: baseURL }, data: {} });
    assert.equal(result.status(), 401);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    if (width === 390) await page.screenshot({ path: 'artifacts/access-request-pending-mobile.png', fullPage: true });
    await page.getByRole('button', { name: 'Back to form' }).click();
    assert.equal(await page.getByLabel('Company', { exact: true }).inputValue(), company);
    await page.getByLabel('Business email').fill('local-test@example.com');
    await page.getByRole('button', { name: 'Request access / continue' }).click();
    await page.locator('.area').first().waitFor();
    assert.equal(await page.locator('.area').count(), 12);
    rows = await sql`select review_status from public.access_requests where company = ${company} and business_email = 'local-test@example.com'`;
    assert.equal(rows.length, width === 1440 ? 1 : 2);
    assert.ok(rows.every(row => row.review_status === 'pending'), 'Allowlisted access remains separate from request review.');
    const payload = { area: fixture.area, confirmed: true,
      answers: Object.fromEntries(Object.entries(fixture).filter(([key]) => !['area', 'process_confirmed'].includes(key))) };
    result = await context.request.post(baseURL + '/api/journey/calculate', { headers: { origin: baseURL }, data: payload });
    assert.equal(result.status(), 200);
    assert.deepEqual(await result.json(), { ...calculation.calculate(payload), source: 'server' }, 'Calculator output remains unchanged behind the gate.');
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('.area').first().waitFor();
    assert.deepEqual(await page.evaluate(() => [Object.keys(localStorage), Object.keys(sessionStorage)]), [[], []]);
    await page.getByRole('button', { name: 'End session' }).click();
    await page.getByLabel('Your name').waitFor();
    assert.equal(await page.getByLabel('Your name').inputValue(), '');
    assert.deepEqual(errors, []);
    await context.close();
    console.log(`PASS: Real browser → local server → Supabase flow at ${width}px; pending, approved, API protection, calculation parity, reload and logout.`);
  }
} catch (error) {
  console.error('Local database/browser test failed:', error instanceof assert.AssertionError ? error.message : (error.code || error.name));
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  const removed = await sql`delete from public.access_requests where company = ${company} and name = ${testName} returning id`;
  console.log(`Removed ${removed.length} synthetic browser-test records; no client records touched.`);
  await sql.end({ timeout: 5 });
}
