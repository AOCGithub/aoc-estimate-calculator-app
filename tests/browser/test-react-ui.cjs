const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright-core');
const Calculation = require('../../public/journey-calculation.js');

const clientRoot = path.resolve(__dirname, '../../dist/client');
const browserCandidates = process.platform === 'win32'
  ? [
      process.env.CHROME_PATH,
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    ]
  : [process.env.CHROME_PATH, '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
const executablePath = browserCandidates.find(candidate => candidate && fs.existsSync(candidate));

if (!executablePath) {
  console.log('SKIP: React browser journey (set CHROME_PATH to an installed Chromium browser).');
  process.exit(0);
}

const mime = {
  '.html': 'text/html;charset=utf-8',
  '.css': 'text/css;charset=utf-8',
  '.js': 'text/javascript;charset=utf-8',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};
const server = http.createServer((request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  if (pathname === '/api/journey/correct') {
    response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ configured: false }));
    return;
  }
  if (pathname === '/api/voice/session') {
    response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ enabled: false, configured: false }));
    return;
  }
  if (pathname === '/api/journey/analyze') {
    response.writeHead(503, { 'content-type': 'application/json' }).end(JSON.stringify({ error: 'AI is not configured in this test.' }));
    return;
  }
  if (pathname === '/api/journey/calculate') {
    let raw = '';
    request.on('data', chunk => { raw += chunk; });
    request.on('end', () => {
      try {
        response.writeHead(200, { 'content-type': 'application/json' })
          .end(JSON.stringify({ ...Calculation.calculate(JSON.parse(raw)), source: 'server' }));
      } catch (error) {
        response.writeHead(400, { 'content-type': 'application/json' })
          .end(JSON.stringify({ error: error.message }));
      }
    });
    return;
  }
  const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
  const file = path.resolve(clientRoot, relative);
  if (!file.startsWith(`${clientRoot}${path.sep}`) && file !== path.join(clientRoot, 'index.html')) {
    response.writeHead(403).end('Forbidden');
    return;
  }
  try {
    response.writeHead(200, { 'content-type': mime[path.extname(file)] || 'application/octet-stream' });
    response.end(fs.readFileSync(file));
  } catch {
    response.writeHead(404).end('Not found');
  }
});

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch({ executablePath, headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    const externalAiRequests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error'
        && !message.text().includes('fonts.googleapis.com')
        && !message.text().includes('Failed to load resource')) errors.push(message.text());
    });
    page.on('request', request => {
      if (request.url().includes('api.openai.com')) externalAiRequests.push(request.url());
    });

    await page.goto(origin, { waitUntil: 'networkidle' });
    assert.equal(await page.locator('.area:not(.area--coming-soon)').count(), 6, 'six business areas are active');
    assert.equal(await page.locator('.area--coming-soon').count(), 5, 'five marketing areas are labelled Coming soon');
    assert.equal(await page.locator('.area').count(), 11, 'unlisted historical categories are not shown');
    assert.equal(await page.locator('.area--coming-soon:disabled').count(), 5);
    assert.equal(await page.locator('#estimateStatus').textContent(), 'NOT CALCULATED');

    await page.getByRole('button', { name: 'Finance & billing', exact: true }).click();
    await page.getByRole('button', { name: 'Describe the work →', exact: true }).click();
    await page.locator('#description').fill(
      'We prepare monthly invoices in Wave and send them through Wave. 3 people across 2 teams do this work. '
      + 'We have notes and examples, with some preparation needed. The team spends 40 hours each month at an average hourly cost of $50 per hour. '
      + 'The system prepares drafts for our team to approve. AOC manages the system and hands it over to multiple teams. '
      + 'The app is customized.',
    );
    await page.getByRole('button', { name: /Organize my description/ }).click();
    await page.getByText(/Basic local organization was used/).waitFor();

    const prefilled = await page.evaluate(() => globalThis.AOCJourney.getState().answers);
    assert.deepEqual(prefilled.systems, ['Wave'], 'local analysis only prefills an app tied to an explicit connection action');
    assert.equal(prefilled.people_count, 3);
    assert.equal(prefilled.department_count, 2);
    assert.equal(prefilled.data_preparation_level, 'partial');
    assert.equal(prefilled.action_mode, 'draft');
    for (const retired of ['responsibility_split', 'management', 'tier', 'handover', 'delivery_mode', 'legacy_system_check']) {
      assert.equal(Object.hasOwn(prefilled, retired), false, `${retired} is excluded from current local analysis`);
    }

    if (!await page.locator('#f_steps_band').isVisible()) {
      await page.getByText('Process complexity', { exact: true }).click();
    }
    await page.locator('#f_steps_band').selectOption('2');
    await page.locator('#f_variation_band').selectOption('2');
    if (!await page.locator('#f_people_count').isVisible()) {
      await page.getByText('2. Team and rollout', { exact: true }).click();
    }
    await page.locator('#f_people_count').fill('3');
    await page.locator('#f_department_count').fill('2');
    if (!await page.locator('#f_action_mode').isVisible()) {
      await page.getByText('Action and review approach', { exact: true }).click();
    }
    await page.locator('#f_action_mode').selectOption('draft');
    await page.getByRole('button', { name: 'Continue →', exact: true }).click();

    await page.locator('#f_systems').fill('Wave');
    await page.locator('#f_workspace_context').selectOption('google_workspace');
    await page.locator('#f_ai_account_context').selectOption('chatgpt_business');
    await page.getByRole('button', { name: 'Continue →', exact: true }).click();

    await page.locator('#f_documentation_readiness').selectOption('Notes or examples');
    await page.locator('#f_data_information_location').selectOption('Apps already identified');
    await page.locator('#f_data_preparation_level').selectOption('partial');
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

    const calculated = await page.evaluate(() => globalThis.AOCJourney.getState().result);
    assert.equal(calculated.build, 7250);
    assert.equal(calculated.audit, 1087.5);
    assert.equal(calculated.monthly, 0);
    assert.equal(calculated.capacity, 1600);
    assert.equal(calculated.cash, null);
    assert.equal(calculated.commercialReady, true);
    assert.equal(await page.locator('#estimateStatus').textContent(), 'ESTIMATE CALCULATED');
    assert.match(await page.locator('.result-hero').textContent(), /Preliminary one-time build range/);
    assert.match(await page.locator('.result-cost-summary').textContent(), /conditional; applied once/);
    assert.match(await page.locator('#result').textContent(), /Unknown or unconfirmed provider and software savings are not counted/);
    assert.doesNotMatch(await page.locator('#result').textContent(), /monthly build program|support tier/i);

    await page.setViewportSize({ width: 320, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'the simplified estimate fits a narrow mobile viewport');
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual(errors, []);
    assert.deepEqual(externalAiRequests, [], 'the local regression never calls a paid AI provider');
    console.log('PASS: active categories, safe local prefill, required context and ROI, fixed-price results, and mobile layout.');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
