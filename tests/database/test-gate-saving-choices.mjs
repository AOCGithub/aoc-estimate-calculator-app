// Opt-in database check: four independent saving choices, synthetic records only.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { chromium } from 'playwright-core';
import postgres from 'postgres';

const live = process.argv.includes('--live');
assert.ok(live !== process.argv.includes('--database'), 'Choose --live or the local --database harness.');
const connection = process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING;
assert.ok(connection, 'Run through Vercel env run for database credentials.');
const require = createRequire(import.meta.url);
const { area, process_confirmed, ...answers } = require('../fixtures/commercial.cjs');
const engine = require('../../public/journey-calculation.js');
const payload = { area, confirmed: process_confirmed, answers };
const target = live ? 'https://estimate.alwaysopencommerce.com' : process.env.AOC_GATE_TEST_URL;
assert.ok(target, 'The local database harness must provide AOC_GATE_TEST_URL.');
if (!live) {
  const url = new URL(target);
  assert.ok(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname), 'Local database checks require a loopback URL.');
}
const company = 'Synthetic Gate Choices ' + randomUUID();
const name = 'Synthetic Saving Choices Test';
const sql = postgres(connection, { prepare: false, max: 1, ssl: 'require', connect_timeout: 15 });
const executablePath = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium'].find(value => value && existsSync(value));
let browser;
let paidCalls = 0;
let passed = 0;

try {
  const response = await fetch(target + '/api/access/status', { signal: AbortSignal.timeout(15000) });
  assert.equal(response.status, 200);
  const status = await response.json();
  for (const key of ['enabled', 'configured', 'intakeOnly', 'savingAvailable', 'recordsEnabled', 'profilesEnabled']) {
    assert.equal(status[key], true, key + ' must be active for this test.');
  }
  assert.equal(Boolean(status.manualApproval), false, 'The test must not enable the paused review workflow.');
  browser = await chromium.launch({ executablePath, headless: true });
  for (const width of [1440, 390]) {
    for (const [remember, record] of [[false, false], [true, false], [false, true], [true, true]]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      const page = await context.newPage();
      page.setDefaultTimeout(20000);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await context.route('**/api/**', route => {
        const request = route.request();
        if (request.method() === 'POST' && ['/api/journey/analyze', '/api/journey/correct', '/api/voice/session']
          .includes(new URL(request.url()).pathname)) {
          paidCalls++;
          return route.abort();
        }
        return route.continue();
      });
      const email = `gate-${width}-${Number(remember)}-${Number(record)}-${randomUUID()}@example.com`;
      const profile = { name, company, website: 'example.com', role: 'Synthetic tester', businessEmail: email };
      const forms = () => sql`select id from public.access_requests where company=${company} and business_email=${email}`;
      const profiles = () => sql`select id,details,facts from public.client_profiles
        where details->>'company'=${company} and details->>'businessEmail'=${email}`;
      try {
        await page.goto(target, { waitUntil: 'networkidle' });
        const rememberBox = page.getByRole('checkbox', { name: /Remember my business details/ });
        const recordBox = page.getByRole('checkbox', { name: /Save my details and estimates/ });
        await page.waitForFunction(() => !document.querySelector('#remember-client-profile')?.disabled);
        assert.equal(await rememberBox.isChecked(), false);
        assert.equal(await recordBox.isChecked(), false);
        const blocked = await context.request.post(target + '/api/journey/calculate', {
          headers: { origin: target }, data: payload,
        });
        assert.equal(blocked.status(), 401, 'Calculation is protected before entry.');
        for (const [id, value] of Object.entries(profile)) await page.locator('#access-' + id).fill(value);
        if (!remember && !record) {
          for (const [id, value] of Object.entries(profile)) {
            const field = page.locator('#access-' + id);
            await field.fill('');
            await page.getByRole('button', { name: 'Continue to calculator', exact: true }).click();
            assert.equal(await field.evaluate(element => element.validity.valueMissing), true);
            assert.equal(await page.locator('.area').count(), 0, id + ' is required.');
            await field.fill(value);
            assert.equal(await field.evaluate(element => element.checkValidity()), true);
          }
          assert.equal((await forms()).length, 0);
          assert.equal((await profiles()).length, 0);
        }
        await rememberBox.setChecked(remember);
        assert.equal(await recordBox.isChecked(), false, 'Profile consent cannot select recording consent.');
        await recordBox.setChecked(record);
        assert.equal(await rememberBox.isChecked(), remember, 'Recording consent cannot change profile consent.');
        await page.getByRole('button', { name: 'Continue to calculator', exact: true }).click();
        await page.locator('.area').first().waitFor();
        assert.equal(await page.locator('.area').count(), 12);
        assert.deepEqual(await page.evaluate(() => AOCJourney.getState().answers), {});

        const requests = await forms();
        assert.equal(requests.length, Number(record), 'Form storage follows only recording consent.');
        const savedProfiles = await profiles();
        assert.equal(savedProfiles.length, Number(remember), 'Profile storage follows only remembering consent.');
        if (remember) {
          assert.equal(savedProfiles[0].details.businessEmail, email);
          assert.deepEqual(savedProfiles[0].facts, {}, 'Entry does not copy estimate facts into a profile.');
        }
        const cookies = await context.cookies();
        const session = cookies.find(cookie => cookie.name === 'aoc_estimator_access');
        assert.ok(session?.httpOnly);
        if (new URL(target).protocol === 'https:') assert.equal(session.secure, true);
        const calculation = await context.request.post(target + '/api/journey/calculate', {
          headers: { origin: target }, data: payload,
        });
        assert.equal(calculation.status(), 200);
        const calculated = await calculation.json();
        assert.deepEqual(calculated.result, engine.calculate(payload).result);
        assert.deepEqual(calculated.record, record ? { saved: true } : { saved: false, skipped: true });
        if (record) {
          const snapshots = await sql`select answers,result from public.estimates where access_request_id=${requests[0].id}`;
          assert.equal(snapshots.length, 1);
          assert.deepEqual(snapshots[0].answers, payload.answers);
          assert.deepEqual(snapshots[0].result, calculated.result);
        }
        assert.equal((await forms()).length, Number(record));
        assert.equal((await profiles()).length, Number(remember));
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        assert.deepEqual(await page.evaluate(() => [Object.keys(localStorage), Object.keys(sessionStorage)]), [[], []]);

        await page.getByRole('button', { name: 'End session', exact: true }).click();
        await page.getByRole('button', { name: 'Continue to calculator', exact: true }).waitFor();
        await page.waitForFunction(() => !document.querySelector('#remember-client-profile')?.disabled);
        for (const id of Object.keys(profile)) assert.equal(await page.locator('#access-' + id).inputValue(), '');
        assert.equal(await rememberBox.isChecked(), false);
        assert.equal(await recordBox.isChecked(), false);
        assert.equal((await context.request.post(target + '/api/journey/calculate', {
          headers: { origin: target }, data: payload,
        })).status(), 401, 'Logout removes calculation access.');
        assert.equal(await page.getByRole('button', { name: 'Review saved details', exact: true }).count(), Number(remember));
        if (remember) {
          await page.getByRole('button', { name: 'Forget saved details', exact: true }).click();
          await page.getByRole('status').filter({ hasText: 'Saved profile removed.' }).waitFor();
          assert.equal((await profiles()).length, 0);
          if (record) {
            assert.equal((await sql`select id from public.estimates where access_request_id=${requests[0].id}`).length, 1,
              'Deleting the optional profile preserves separately saved estimates.');
          }
        }
        assert.deepEqual(errors, []);
        passed++;
        console.log(`PASS: ${width}px remember=${remember}, record=${record}; database contents, calculation parity, logout and profile deletion.`);
      } finally {
        await context.close();
      }
    }
  }
  assert.equal(paidCalls, 0);
  assert.equal(passed, 8);
  assert.equal((await sql`select id from public.access_requests where company=${company} and name=${name}`).length, 4);
  assert.equal((await sql`select e.id from public.estimates e join public.access_requests a on a.id=e.access_request_id
    where a.company=${company} and a.name=${name}`).length, 4);
  console.log(`PASS: All four ${live ? 'live' : 'local production-build'} saving choices on desktop/mobile. Required-field checks passed. No paid AI.`);
} catch (error) {
  console.error('Gate/saving choices failed:', error instanceof assert.AssertionError || error.name === 'TimeoutError'
    ? error.message : (error.code || error.name));
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  const estimates = await sql`delete from public.estimates where access_request_id in
    (select id from public.access_requests where company=${company} and name=${name}) returning id`;
  const requests = await sql`delete from public.access_requests where company=${company} and name=${name} returning id`;
  const profiles = await sql`delete from public.client_profiles where details->>'company'=${company}
    and details->>'name'=${name} returning id`;
  console.log(`Cleanup: ${requests.length} synthetic submissions, ${estimates.length} synthetic estimates, ${profiles.length} remaining synthetic profiles. Existing client records preserved.`);
  await sql.end({ timeout: 5 });
}
