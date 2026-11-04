const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const target = process.env.AOC_PROFILE_TEST_URL || 'http://127.0.0.1:5174';
const fields = { 'Your name': 'Profile Browser Test', Company: 'Profile Example A', 'Company website': 'example.com', 'Your role': 'Testing', 'Business email': 'profile-browser@example.com' };
async function fill(page, changes = {}) {
  for (const [label, value] of Object.entries({ ...fields, ...changes })) await page.getByLabel(label, { exact: true }).fill(value);
}
async function open(page) {
  const response = await page.goto(target, { waitUntil: 'networkidle' });
  assert.equal(response.status(), 200, 'Start npm run dev:profiles before this test.');
  await page.getByRole('checkbox', { name: 'Remember my business details for next time (optional)', exact: true }).waitFor();
  await page.waitForFunction(() => !document.querySelector('#remember-client-profile').disabled);
  assert.equal(await page.getByRole('checkbox', { name: /Remember my business/ }).isChecked(), false);
  const estimates = page.getByRole('checkbox', { name: /Save my details/ });
  assert.equal(await estimates.isChecked(), false, 'estimate recording is an independent unchecked choice');
  if (!await estimates.isDisabled()) {
    await estimates.check();
    assert.equal(await page.getByRole('checkbox', { name: /Remember my business/ }).isChecked(), false, 'recording consent does not select profile consent');
    await estimates.uncheck();
  }
}
async function enter(page, remember = false) {
  if (remember) await page.getByRole('checkbox', { name: /Remember my business/ }).check();
  assert.equal(await page.getByRole('checkbox', { name: /Save my details/ }).isChecked(), false, 'remembering details does not select estimate recording');
  await page.getByRole('button', { name: 'Continue to calculator' }).click();
  await page.locator('.area').first().waitFor();
  assert.equal(await page.locator('.area').count(), 12);
  assert.deepEqual(await page.evaluate(() => AOCJourney.getState().answers), {}, 'Reused business details do not reuse an old estimate.');
}
async function end(page) {
  await page.getByRole('button', { name: 'End session', exact: true }).click();
  await page.getByRole('heading', { name: 'Your business details' }).waitFor();
  await page.waitForFunction(() => !document.querySelector('#remember-client-profile').disabled);
  assert.equal(await page.getByRole('checkbox', { name: /Remember my business/ }).isChecked(), false);
}
const fits = page => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const contexts = [];
  const errors = [];
  let paidCalls = 0, profileWrites = 0;
  try {
    for (const width of [1440, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
      contexts.push(context);
      await context.route('**/api/**', async route => {
        const request = route.request(), pathname = new URL(request.url()).pathname;
        if (pathname === '/api/client-profile' && request.method() === 'POST') profileWrites++;
        if (pathname === '/api/access/verify') assert.equal(request.postDataJSON().saveData, false, 'Trial never saves to Supabase.');
        if (request.method() === 'POST' && ['/api/journey/analyze', '/api/journey/correct', '/api/voice/session'].includes(pathname)) { paidCalls++; return route.abort(); }
        return route.continue();
      });
    }
    const a = await contexts[0].newPage(), b = await contexts[1].newPage();
    a.on('pageerror', error => errors.push(error.message));
    b.on('pageerror', error => errors.push(error.message));
    await open(a);
    await a.getByRole('button', { name: 'Continue to calculator' }).click();
    assert.equal(await a.locator('.area').count(), 0, 'Required fields remain required.');
    await fill(a);
    await enter(a);
    assert.equal(profileWrites, 0, 'Unchecked consent writes no profile.');
    await end(a);
    assert.equal(await a.getByRole('button', { name: 'Review saved details', exact: true }).count(), 0);
    await fill(a);
    await enter(a, true);
    assert.equal(profileWrites, 1);
    await end(a);
    await a.getByRole('button', { name: 'Review saved details', exact: true }).waitFor();
    assert.equal(await a.getByLabel('Your name', { exact: true }).inputValue(), '', 'Returning does not automatically load personal details.');
    await a.getByRole('button', { name: 'Review saved details', exact: true }).click();
    await a.getByRole('heading', { name: 'Review before reusing' }).waitFor();
    assert.equal(await a.getByLabel('Company', { exact: true }).inputValue(), '');
    await a.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.equal(await a.getByLabel('Company', { exact: true }).inputValue(), '', 'Cancel never applies saved facts.');
    await a.getByLabel('Company', { exact: true }).fill('Current manual company');
    await a.getByRole('button', { name: 'Review saved details', exact: true }).click();
    await a.getByRole('button', { name: 'Use these details', exact: true }).click();
    assert.equal(await a.getByLabel('Company', { exact: true }).inputValue(), 'Current manual company');
    assert.equal(await a.getByLabel('Your name', { exact: true }).inputValue(), '', 'Conflicting identity cannot mix two client profiles.');
    await a.getByRole('alert').filter({ hasText: 'different identity or company details' }).waitFor();
    await a.getByLabel('Company', { exact: true }).fill('');
    await a.getByLabel('Your role', { exact: true }).fill('Current manual role');
    await a.getByRole('button', { name: 'Use these details', exact: true }).click();
    assert.equal(await a.getByLabel('Your role', { exact: true }).inputValue(), 'Current manual role');
    assert.equal(await a.getByLabel('Your name', { exact: true }).inputValue(), fields['Your name']);
    assert.equal(await a.getByRole('checkbox', { name: /Remember my business/ }).isChecked(), false, 'Reuse is not new saving consent.');
    await enter(a);
    assert.equal(profileWrites, 1, 'Declining saving does not update the old profile.');
    await end(a);
    await a.getByRole('button', { name: 'Review saved details', exact: true }).click();
    assert.ok((await a.locator('.client-profile-review dl').textContent()).includes(fields.Company));
    await a.screenshot({ path: 'artifacts/client-profile-review-desktop.png', fullPage: true });
    assert.ok(await fits(a));
    await a.getByRole('button', { name: 'Use these details', exact: true }).click();
    await a.getByLabel('Your role', { exact: true }).fill('Reviewed updated role');
    await enter(a, true);
    await end(a);
    await a.getByRole('button', { name: 'Review saved details', exact: true }).click();
    assert.ok((await a.locator('.client-profile-review dl').textContent()).includes('Reviewed updated role'));

    // The same email in a new browser is not evidence of profile ownership.
    await open(b);
    await b.getByLabel('Business email', { exact: true }).fill(fields['Business email']);
    assert.equal(await b.getByRole('button', { name: 'Review saved details', exact: true }).count(), 0);
    assert.equal((await b.request.get(target + '/api/client-profile')).status(), 404);
    await fill(b, { 'Your name': 'Separate Visitor', Company: 'Profile Example B' });
    await enter(b, true);
    await end(b);
    await b.getByRole('button', { name: 'Review saved details', exact: true }).click();
    const previewB = await b.locator('.client-profile-review dl').textContent();
    assert.ok(previewB.includes('Profile Example B'));
    assert.ok(!previewB.includes(fields.Company));
    await b.screenshot({ path: 'artifacts/client-profile-review-mobile.png', fullPage: true });
    assert.ok(await fits(b));
    await b.setViewportSize({ width: 320, height: 900 });
    assert.ok(await fits(b));

    // A failed opt-in save blocks only that save; opting out remains usable.
    await a.getByRole('button', { name: 'Use these details', exact: true }).click();
    await a.route('**/api/client-profile', async route => route.request().method() === 'POST'
      ? route.fulfill({ status: 503, json: { error: 'Test profile store is unavailable.' } }) : route.continue());
    await a.getByRole('checkbox', { name: /Remember my business/ }).check();
    await a.getByRole('button', { name: 'Continue to calculator' }).click();
    await a.getByRole('alert').filter({ hasText: 'Test profile store is unavailable.' }).waitFor();
    assert.equal(await a.getByLabel('Your role', { exact: true }).inputValue(), 'Reviewed updated role');
    assert.equal(await a.locator('.area').count(), 0);
    await a.getByRole('checkbox', { name: /Remember my business/ }).uncheck();
    await enter(a);
    await a.unroute('**/api/client-profile');
    // Actual calculation remains available with no production database writes.
    const fixture = require('./fixtures/commercial.cjs');
    const { area, process_confirmed, ...answers } = fixture;
    const calculation = await a.request.post(target + '/api/journey/calculate', { headers: { origin: target }, data: { area, answers, confirmed: process_confirmed } });
    assert.equal(calculation.status(), 200);
    assert.equal((await calculation.json()).result.build, 11500);
    await end(a);
    await a.getByRole('button', { name: 'Forget saved details', exact: true }).click();
    await a.getByRole('status').filter({ hasText: 'Saved profile removed.' }).waitFor();
    assert.equal((await a.request.get(target + '/api/client-profile')).status(), 404);
    assert.equal((await b.request.get(target + '/api/client-profile')).status(), 200, 'Forgetting A does not delete B.');
    await b.getByRole('button', { name: 'Forget saved details', exact: true }).click();
    await b.getByRole('status').filter({ hasText: 'Saved profile removed.' }).waitFor();
    assert.equal((await b.request.get(target + '/api/client-profile')).status(), 404);
    assert.equal(paidCalls, 0);
    const { localProfileDatabasePath } = await import('../server/local-client-profiles.mjs');
    const download = await a.request.get(target + '/@fs/' + localProfileDatabasePath.replaceAll('\\', '/'));
    assert.ok([403,404].includes(download.status()), 'Private local files cannot be downloaded from the application.');
    assert.deepEqual(errors, []);
    console.log('PASS: '+(process.env.AOC_PROFILE_STORAGE_KIND==='supabase'?'Supabase production-build':'Offline')+' desktop/mobile opt-out, consent, explicit review/reuse, preserved edits, fresh estimates, same-email separation, failure recovery, calculation and forgetting. No paid AI.');
  } finally {
    // Only remove this test's own capability-bound profiles, including on failure.
    for (const context of contexts) {
      const status = await context.request.get(target + '/api/client-profile/status').then(response => response.json()).catch(() => ({}));
      await context.request.delete(target + '/api/client-profile', { headers: { origin: target, 'if-match': status.revision || '' } }).catch(() => {});
      await context.close();
    }
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
