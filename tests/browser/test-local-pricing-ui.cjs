const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright-core');
const { createPreviewServer } = require('../../scripts/dev/local-test-pricing.cjs');
const fixture = require('../fixtures/local-test-pricing.json');
const executablePath = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].find(path => path && fs.existsSync(path));
if (!executablePath) throw Error('Set CHROME_PATH to run the local pricing browser check.');

(async () => {
  const server = createPreviewServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch({ executablePath, headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    const providerRequests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
      if (request.url().includes('api.openai.com')) providerRequests.push(request.url());
    });

    await page.goto(origin, { waitUntil: 'networkidle' });
    const banner = page.getByRole('note', { name: 'Synthetic local pricing' });
    assert.ok(await banner.isVisible());
    assert.match(await banner.textContent(), /NOT APPROVED AOC PRICING/);
    await page.getByRole('button', { name: 'Finance & billing', exact: true }).click();
    await page.getByRole('button', { name: 'Describe the work →', exact: true }).click();
    await page.locator('#description').fill('We send invoices through Wave and review them before sending.');
    await page.getByRole('button', { name: /Continue with editable fields/ }).click();

    if (!await page.locator('#f_steps_band').isVisible()) {
      await page.getByText('Process complexity', { exact: true }).click();
    }
    await page.locator('#f_steps_band').selectOption('2');
    await page.locator('#f_variation_band').selectOption('2');
    if (!await page.locator('#f_people_count').isVisible()) {
      await page.getByText('2. Team and rollout', { exact: true }).click();
    }
    await page.locator('#f_people_count').fill('3');
    await page.locator('#f_department_count').fill('1');
    if (!await page.locator('#f_action_mode').isVisible()) {
      await page.getByText('Action and review approach', { exact: true }).click();
    }
    await page.locator('#f_action_mode').selectOption('draft');
    await page.getByRole('button', { name: 'Continue →', exact: true }).click();

    await page.locator('#f_systems').fill('None');
    await page.locator('#f_workspace_context').selectOption('none');
    await page.locator('#f_ai_account_context').selectOption('none');
    await page.getByRole('button', { name: 'Continue →', exact: true }).click();

    await page.locator('#f_documentation_readiness').selectOption('Clear and current');
    await page.locator('#f_data_information_location').selectOption('Shared files');
    await page.locator('#f_data_preparation_level').selectOption('clean');
    await page.locator('#f_data_preparation_owner').selectOption('Our team');
    await page.getByRole('button', { name: 'Continue →', exact: true }).click();

    await page.locator('#f_team_time').fill('40');
    await page.locator('#f_blended_hourly_cost').fill('50');
    await page.getByRole('button', { name: 'Continue →', exact: true }).click();
    await page.locator('.check input').check();
    await page.getByRole('button', { name: /Confirm details & calculate/ }).click();
    await page.waitForFunction(() => {
      const state = globalThis.AOCJourney.getState();
      return !state.dirty && !state.calculating && state.calculationSource === 'server';
    });

    const result = await page.evaluate(() => globalThis.AOCJourney.getState().result);
    const answers = await page.evaluate(() => globalThis.AOCJourney.getState().answers);
    const expectedBuild = fixture.moderateCore + 250 + 500 + 500 + 500;
    assert.equal(result.build, expectedBuild, JSON.stringify({ lines: result.lines, systems: answers.systems }));
    assert.equal(result.audit, Math.round(expectedBuild * 0.15 * 100) / 100);
    assert.equal(result.monthly, 0);
    assert.ok(result.commercialReady);
    assert.match(await page.locator('.result-hero').textContent(), /\$2,400–\$3,700/);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'estimate and form fit mobile width');
    assert.deepEqual(errors, []);
    assert.deepEqual(providerRequests, []);
    console.log('PASS: the simplified local calculator uses isolated synthetic core pricing, shows the current estimate, fits mobile, and makes no paid AI calls.');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
