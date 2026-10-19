const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright-core');

const clientRoot = path.resolve(__dirname, '../dist/client');
const browserCandidates = process.platform === 'win32'
  ? [
      process.env.CHROME_PATH,
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    ]
  : [process.env.CHROME_PATH, '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
const executablePath = browserCandidates.find((candidate) => candidate && fs.existsSync(candidate));
const capture = process.argv.includes('--capture');
const artifactsDirectory = path.resolve(__dirname, '../artifacts');

if (!executablePath) {
  console.log('SKIP: React browser journey (set CHROME_PATH to an installed Chromium browser).');
  process.exit(0);
}

const mime = {
  '.html': 'text/html;charset=utf-8',
  '.css': 'text/css;charset=utf-8',
  '.js': 'text/javascript;charset=utf-8',
};

const server = http.createServer((request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  if (pathname === '/api/journey/analyze') {
    response.writeHead(429, { 'content-type': 'application/json' }).end(JSON.stringify({
      error: 'Synthetic provider failure',
    }));
    return;
  }
  if (pathname === '/api/journey/calculate') {
    response.writeHead(503, { 'content-type': 'application/json' }).end(JSON.stringify({
      error: 'Synthetic calculation service failure',
    }));
    return;
  }
  if (pathname === '/favicon.ico') {
    response.writeHead(204).end();
    return;
  }
  const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
  const file = path.resolve(clientRoot, relative);
  if (!file.startsWith(`${clientRoot}${path.sep}`) && file !== path.join(clientRoot, 'index.html')) {
    response.writeHead(403).end('Forbidden');
    return;
  }
  try {
    const body = fs.readFileSync(file);
    response.writeHead(200, { 'content-type': mime[path.extname(file)] || 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404).end('Not found');
  }
});

(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const browser = await chromium.launch({ executablePath, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('console', (message) => {
    const expectedLocalApiError = /\/api\/journey\/(analyze|calculate)$/.test(message.location().url)
      && message.text().includes('Failed to load resource');
    if (
      message.type() === 'error'
      && !message.text().includes('fonts.googleapis.com')
      && !expectedLocalApiError
    ) errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));

  try {
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    assert.ok(await page.locator('.live-context__location').textContent(), 'timezone-derived location renders');
    assert.ok(await page.locator('.live-context__date').textContent(), 'live local date renders');
    assert.ok(Date.parse(await page.locator('.live-context time').getAttribute('datetime')), 'machine-readable live time renders');
    if (capture) {
      fs.mkdirSync(artifactsDirectory, { recursive: true });
      await page.screenshot({ path: path.join(artifactsDirectory, 'estimator-home.png'), fullPage: true });
    }
    assert.equal(await page.locator('.area').count(), 12, 'all business areas render');
    await page.getByRole('button', { name: 'Finance and billing' }).click();
    await page.getByRole('button', { name: 'Describe the work →', exact: true }).click();
    await page.locator('#description').fill('We prepare monthly invoices in Wave. 3 people across 2 teams do this work. We have notes and examples, with some preparation needed. AOC manages it and prepares drafts for our team to approve.');
    await page.getByRole('button', { name: /Organize my description/ }).click();
    await page.getByText(/Basic local organization was used/).waitFor();
    assert.match(
      await page.evaluate(() => globalThis.AOCJourney.getState().description),
      /monthly invoices/,
      'description survives an API failure',
    );
    assert.deepEqual(
      await page.evaluate(() => globalThis.AOCJourney.getState().answers.systems),
      ['Wave'],
      'local organizer extracts explicitly named apps without inventing others',
    );
    const localPrefill = await page.evaluate(() => globalThis.AOCJourney.getState().answers);
    assert.equal(localPrefill.people_count, 3, 'local organizer extracts an explicit people count');
    assert.equal(localPrefill.department_count, 2, 'local organizer extracts an explicit team count');
    assert.equal(localPrefill.cadence, 'monthly', 'local organizer extracts an explicit cadence');
    assert.equal(localPrefill.documentation_readiness, 'Notes or examples', 'local organizer extracts explicit documentation readiness');
    assert.equal(localPrefill.data_preparation_level, 'Some preparation', 'local organizer extracts explicit data preparation');
    assert.equal(localPrefill.responsibility_split, 'aoc', 'local organizer normalizes responsibility ownership');
    assert.equal(localPrefill.management, 'yes', 'management is derived from responsibility ownership');
    assert.equal(localPrefill.action_mode, 'draft', 'local organizer extracts the approval boundary');
    const organizedScope = await page.evaluate(() => globalThis.AOCJourney.getState());
    assert.ok(organizedScope.routes.includes('Create and send invoices'), 'local organizer selects the matching category route');
    assert.ok(organizedScope.visible.includes('invoice_cadence') || organizedScope.visible.includes('invoice_volume'), 'local organizer surfaces relevant category questions');

    await page.locator('#f_solution').selectOption('workflow');
    assert.equal(await page.locator('#mainPanel input:visible, #mainPanel select:visible').count(), 1, 'scope starts with one primary choice and compact required groups');
    if (capture) await page.screenshot({ path: path.join(artifactsDirectory, 'estimator-scope-simple.png'), fullPage: true });
    await page.getByText(/Process complexity/).click();
    await page.locator('#f_steps_band').selectOption('3');
    await page.locator('#f_variation_band').selectOption('3');
    await page.getByText(/Team and rollout/).click();
    await page.locator('#f_people_count').fill('3');
    await page.locator('#f_department_count').fill('2');
    await page.locator('#f_cadence').selectOption('monthly');
    await page.locator('#f_handover').selectOption('group');
    await page.getByRole('button', { name: /Continue/ }).click();

    await page.locator('#f_systems').fill('Hubstaff Time, Wave, Google Docs, Google Drive, Help Scout, Stripe');
    assert.equal(await page.locator('#f_legacy_system_check option[value="Restricted"]').count(), 1, 'restricted apps have a direct primary choice');
    await page.locator('#f_legacy_system_check').selectOption('Restricted');
    assert.ok(await page.locator('#f_app_known_restrictions').isVisible(), 'restricted choice exposes restriction details');
    assert.ok(await page.locator('#f_app_alternative_approach').isVisible(), 'restricted choice exposes alternative approaches');
    await page.locator('#f_legacy_system_check').selectOption('Standard');
    assert.equal(await page.locator('#mainPanel input:visible, #mainPanel select:visible').count(), 2, 'apps step keeps two core fields visible');
    await page.getByRole('button', { name: /Continue/ }).click();

    assert.equal(await page.locator('#mainPanel select:visible').count(), 2, 'data step keeps both estimate-sensitive fields visible');
    await page.locator('#f_documentation_readiness').selectOption('Notes or examples');
    await page.locator('#f_data_preparation_level').selectOption('Some preparation');
    await page.getByRole('button', { name: /Continue/ }).click();

    assert.equal(await page.locator('#mainPanel input:visible, #mainPanel select:visible').count(), 0, 'ROI inputs are optional and initially collapsed');
    await page.getByText('Calculate potential value', { exact: true }).click();
    await page.locator('#f_team_time').fill('40');
    await page.locator('#f_blended_hourly_cost').fill('50');
    await page.locator('#f_software_replaced_portion').selectOption('none');
    await page.locator('#f_incremental_software_cost').fill('0');
    await page.getByRole('button', { name: /Continue/ }).click();

    await page.locator('#f_responsibility_split').selectOption('aoc');
    await page.locator('#f_action_mode').selectOption('approved');
    await page.locator('#f_consequential').selectOption('yes');
    await page.getByRole('button', { name: /Priority/ }).click();
    await page.locator('.check input').check();
    await page.getByRole('button', { name: /Confirm details & calculate/ }).click();

    await page.getByText('$11,500', { exact: true }).waitFor();
    await page.getByText('$550 / month', { exact: true }).waitFor();
    assert.equal(await page.locator('#estimateStatus').textContent(), 'LOCAL PREVIEW · VERIFY');
    assert.equal(await page.evaluate(() => globalThis.AOCJourney.getState().calculationSource), 'local-preview');
    assert.ok(await page.getByText('Recommended solution and connected scope', { exact: true }).isVisible());
    assert.ok(await page.getByText('Create and send invoices', { exact: true }).last().isVisible());
    if (capture) await page.screenshot({ path: path.join(artifactsDirectory, 'estimator-result.png'), fullPage: true });

    await page.locator('#f_responsibility_split').selectOption('client');
    assert.match(await page.locator('#estimateStatus').textContent(), /RECALCULATE/);
    await page.locator('.check input').check();
    await page.getByRole('button', { name: /Confirm details & calculate/ }).click();
    const monthlyService = page.getByText('AOC monthly service', { exact: true }).locator('..').locator(':scope > .value');
    await page.waitForFunction(() => globalThis.AOCJourney.getState().result?.monthly === 0);
    assert.equal(await monthlyService.textContent(), '$0');

    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      true,
      'mobile layout has no page-level horizontal overflow',
    );
    if (capture) await page.screenshot({ path: path.join(artifactsDirectory, 'estimator-mobile.png'), fullPage: true });
    assert.deepEqual(errors, [], `browser errors: ${errors.join('; ')}`);
    console.log('PASS: React browser journey, fixture totals, stale recalculation, self-management, and mobile overflow.');
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  server.close(() => process.exit(1));
});
