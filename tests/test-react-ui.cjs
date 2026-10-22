const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright-core');
const JourneyCalculation = require('../public/journey-calculation.js');

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
let calculationMode = 'unavailable';
let analysisDelay = 0;

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
    const sendAnalysisFailure = () => response.writeHead(429, { 'content-type': 'application/json' }).end(JSON.stringify({
      error: 'Synthetic provider failure',
    }));
    if (analysisDelay) setTimeout(sendAnalysisFailure, analysisDelay);
    else sendAnalysisFailure();
    return;
  }
  if (pathname === '/api/journey/calculate') {
    if (calculationMode === 'unavailable') {
      response.writeHead(503, { 'content-type': 'application/json' }).end(JSON.stringify({
        error: 'Synthetic calculation service failure',
      }));
      return;
    }
    if (calculationMode === 'validation') {
      response.writeHead(400, { 'content-type': 'application/json' }).end(JSON.stringify({
        error: 'Synthetic validation rejection',
      }));
      return;
    }
    let raw = '';
    request.on('data', (chunk) => { raw += chunk; });
    request.on('end', () => {
      try {
        response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({
          ...JourneyCalculation.calculate(JSON.parse(raw)),
          source: 'server',
        }));
      } catch (error) {
        response.writeHead(400, { 'content-type': 'application/json' }).end(JSON.stringify({
          error: error.message,
        }));
      }
    });
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
    assert.equal(await page.locator('.section-transition').count(), 1, 'active form section has a transition wrapper');
    assert.equal(
      await page.locator('.section-transition').evaluate((element) => getComputedStyle(element).animationName),
      'section-transition-enter',
      'section changes use the configured smooth transition',
    );
    assert.ok(await page.locator('.live-context__location').textContent(), 'timezone-derived location renders');
    assert.ok(await page.locator('.live-context__date').textContent(), 'live local date renders');
    assert.ok(Date.parse(await page.locator('.live-context time').getAttribute('datetime')), 'machine-readable live time renders');
    if (capture) {
      fs.mkdirSync(artifactsDirectory, { recursive: true });
      await page.screenshot({ path: path.join(artifactsDirectory, 'estimator-home.png'), fullPage: true });
    }
    assert.equal(await page.locator('.area').count(), 12, 'all business areas render');
    assert.equal(
      await page.getByRole('button', { name: 'Orders, inventory, and fulfillment' }).locator('.icon').textContent(),
      '▦',
      'orders and fulfillment uses the requested icon glyph',
    );
    await page.getByRole('button', { name: 'Finance and billing' }).click();
    await page.getByRole('button', { name: 'Describe the work →', exact: true }).click();
    await page.locator('#description').fill('We prepare monthly invoices in Wave. 3 people across 2 teams do this work. We have notes and examples, with some preparation needed. AOC manages it and prepares drafts for our team to approve.');
    analysisDelay = capture ? 800 : 250;
    await page.getByRole('button', { name: /Organize my description/ }).click();
    assert.ok(await page.locator('#organizing-status').isVisible(), 'organizer shows an immediate processing status');
    assert.match(await page.locator('#organizing-status').textContent(), /Reading the work and outcome/);
    assert.equal(await page.locator('#description').getAttribute('readonly'), '', 'description is protected while organization is running');
    assert.equal(await page.getByRole('button', { name: /Organizing/ }).getAttribute('aria-busy'), 'true', 'organizer exposes its busy state');
    assert.equal(await page.getByRole('button', { name: /Continue with editable fields/ }).isDisabled(), true, 'alternate continuation is paused during organization');
    if (capture) {
      await page.waitForTimeout(250);
      await page.screenshot({ path: path.join(artifactsDirectory, 'estimator-organizing.png'), fullPage: true });
    }
    await page.getByText(/Basic local organization was used/).waitFor();
    analysisDelay = 0;
    assert.equal(await page.locator('#organizing-status').count(), 0, 'processing status clears after organization');
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
    await page.getByText(/Review detailed scope/).click();
    await page.getByRole('button', { name: 'Send payment reminders', exact: true }).click();
    await page.getByRole('navigation').getByText('Describe the work', { exact: true }).click();
    await page.getByRole('button', { name: /Organize my description/ }).click();
    await page.getByText(/Basic local organization was used/).waitFor();
    assert.ok(
      (await page.evaluate(() => globalThis.AOCJourney.getState().routes)).includes('Send payment reminders'),
      'manual route selection survives reorganization',
    );

    await page.getByRole('navigation').getByText('Responsibilities and service', { exact: true }).click();
    await page.locator('#f_responsibility_split').selectOption('client');
    await page.getByRole('navigation').getByText('Describe the work', { exact: true }).click();
    await page.getByRole('button', { name: /Organize my description/ }).click();
    await page.getByText(/Basic local organization was used/).waitFor();
    const correctedOwnership = await page.evaluate(() => globalThis.AOCJourney.getState().answers);
    assert.equal(correctedOwnership.responsibility_split, 'client', 'manual responsibility choice survives reorganization');
    assert.equal(correctedOwnership.management, 'no', 'derived management remains consistent with the manual responsibility choice');

    await page.locator('#f_solution').selectOption('workflow');
    assert.equal(await page.locator('#f_solution').getAttribute('required'), '', 'solution is marked required');
    assert.equal(await page.locator('#mainPanel input:visible, #mainPanel select:visible').count(), 1, 'scope starts with one primary choice and compact required groups');
    if (capture) await page.screenshot({ path: path.join(artifactsDirectory, 'estimator-scope-simple.png'), fullPage: true });
    await page.getByText(/Process complexity/).click();
    assert.equal(await page.locator('#f_steps_band').getAttribute('aria-invalid'), 'true', 'missing required field is identified');
    assert.equal(await page.locator('#f_steps_band_requirement').textContent(), 'Required', 'missing required field has a visible indicator');
    await page.locator('#f_steps_band').selectOption('3');
    assert.equal(await page.locator('#f_steps_band').getAttribute('aria-invalid'), null, 'required indicator clears after answering');
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
    assert.equal(await page.locator('#f_legacy_system_check').getAttribute('aria-invalid'), null, 'required app condition is complete after selection');
    assert.equal(await page.locator('#mainPanel input:visible, #mainPanel select:visible').count(), 2, 'apps step keeps two core fields visible');
    await page.getByRole('button', { name: /Continue/ }).click();

    assert.equal(await page.locator('#mainPanel select:visible').count(), 2, 'data step keeps both estimate-sensitive fields visible');
    await page.locator('#f_documentation_readiness').selectOption('Notes or examples');
    await page.locator('#f_data_preparation_level').selectOption('Some preparation');
    await page.getByText('Preparation details', { exact: true }).click();
    assert.ok(await page.locator('#f_data_material_volume').isVisible(), 'material volume appears when preparation is needed');
    assert.equal(await page.locator('#f_data_material_format').count(), 0, 'format detail remains hidden without substantial preparation');
    assert.equal(await page.locator('#f_data_material_restriction').count(), 0, 'restriction detail remains hidden without an uncertainty trigger');
    await page.getByRole('button', { name: /Continue/ }).click();

    assert.equal(await page.locator('#mainPanel input:visible, #mainPanel select:visible').count(), 0, 'ROI inputs are optional and initially collapsed');
    await page.getByText('Calculate potential value', { exact: true }).click();
    await page.locator('#f_team_time').fill('40');
    await page.locator('#f_blended_hourly_cost').fill('50');
    await page.locator('#f_software_replaced_portion').selectOption('none');
    await page.locator('#f_incremental_software_cost').fill('0');
    await page.getByRole('button', { name: /Continue/ }).click();

    await page.locator('#f_responsibility_split').selectOption('help');
    assert.equal(await page.evaluate(() => globalThis.AOCJourney.getState().answers.management), null, 'help deciding does not choose management');
    await page.locator('#f_responsibility_split').selectOption('aoc');
    assert.equal(await page.locator('#tier_requirement').textContent(), 'Required', 'missing managed-service tier has an indicator');
    await page.locator('#f_action_mode').selectOption('approved');
    await page.locator('#f_consequential').selectOption('yes');
    await page.getByRole('button', { name: /Priority/ }).click();
    await page.getByText('Responsibility and coverage details', { exact: true }).click();
    assert.ok(await page.locator('#f_client_approval_checkpoints').isVisible(), 'approval details appear when consequential actions are selected');
    assert.ok(await page.locator('#f_expert_review_frequency').isVisible(), 'expert review cadence appears for AOC management');
    assert.ok(await page.locator('#f_pending_approval_behavior').isVisible(), 'pending approval behavior appears for approval-gated work');
    assert.equal(await page.locator('#f_manual_fallback').count(), 0, 'untriggered resilience detail remains hidden');
    assert.equal(await page.locator('#f_operating_deadlines').count(), 0, 'untriggered deadline detail remains hidden');
    assert.equal(await page.locator('.check--missing-required .required-indicator').textContent(), 'Required', 'missing final confirmation has an indicator');
    await page.locator('.check input').check();
    assert.equal(await page.locator('.check--missing-required').count(), 0, 'confirmation indicator clears after checking');
    await page.getByRole('button', { name: /Confirm details & calculate/ }).click();

    await page.getByText('$11,500', { exact: true }).waitFor();
    await page.getByText('$550 / month', { exact: true }).waitFor();
    assert.equal(await page.locator('#estimateStatus').textContent(), 'LOCAL PREVIEW · VERIFY');
    assert.equal(await page.evaluate(() => globalThis.AOCJourney.getState().calculationSource), 'local-preview');
    assert.ok(await page.getByText('AOC monthly service scope', { exact: true }).isVisible());
    assert.ok(await page.getByText('Recommended solution and connected scope', { exact: true }).isVisible());
    assert.ok(await page.getByText('Create and send invoices', { exact: true }).last().isVisible());
    if (capture) await page.screenshot({ path: path.join(artifactsDirectory, 'estimator-result.png'), fullPage: true });

    await page.locator('#f_responsibility_split').selectOption('client');
    assert.match(await page.locator('#estimateStatus').textContent(), /RECALCULATE/);
    await page.locator('.check input').check();
    calculationMode = 'server';
    await page.getByRole('button', { name: /Confirm details & calculate/ }).click();
    const monthlyService = page.getByText('AOC monthly service', { exact: true }).locator('..').locator(':scope > .value');
    await page.waitForFunction(() => globalThis.AOCJourney.getState().result?.monthly === 0);
    assert.equal(await monthlyService.textContent(), '$0');
    assert.equal(await page.locator('#estimateStatus').textContent(), 'SERVER VERIFIED');
    assert.equal(await page.evaluate(() => globalThis.AOCJourney.getState().calculationSource), 'server');

    calculationMode = 'validation';
    await page.locator('#f_responsibility_split').selectOption('aoc');
    await page.getByRole('button', { name: /Priority/ }).click();
    await page.locator('.check input').check();
    await page.getByRole('button', { name: /Confirm details & calculate/ }).click();
    await page.getByText('Synthetic validation rejection', { exact: true }).waitFor();
    assert.equal(
      await page.evaluate(() => globalThis.AOCJourney.getState().result?.monthly),
      0,
      'a server validation error does not replace the last verified result with a local calculation',
    );
    assert.equal(await page.evaluate(() => globalThis.AOCJourney.getState().dirty), true);

    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      true,
      'mobile layout has no page-level horizontal overflow',
    );
    if (capture) await page.screenshot({ path: path.join(artifactsDirectory, 'estimator-mobile.png'), fullPage: true });

    await page.getByRole('navigation').getByText('Business area', { exact: true }).click();
    page.once('dialog', async (dialog) => {
      assert.match(dialog.message(), /clears this estimate/i);
      await dialog.dismiss();
    });
    await page.getByRole('button', { name: 'Orders, inventory, and fulfillment', exact: true }).click();
    assert.equal(await page.evaluate(() => globalThis.AOCJourney.getState().area), 'area0', 'canceling an area change preserves the estimate');

    const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    mobilePage.on('console', (message) => {
      const expectedLocalApiError = /\/api\/journey\/(analyze|calculate)$/.test(message.location().url)
        && message.text().includes('Failed to load resource');
      if (
        message.type() === 'error'
        && !message.text().includes('fonts.googleapis.com')
        && !expectedLocalApiError
      ) errors.push(message.text());
    });
    mobilePage.on('pageerror', (error) => errors.push(error.message));

    await mobilePage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await mobilePage.getByRole('button', { name: 'Finance and billing', exact: true }).click();
    await mobilePage.getByRole('button', { name: /^Describe the work/ }).click();
    await mobilePage.locator('#description').fill('We prepare monthly invoices in Wave. 3 people across 2 teams do this work. We have notes and examples, with some preparation needed. AOC manages it and prepares drafts for our team to approve.');
    await mobilePage.getByRole('button', { name: /Organize my description/ }).click();
    await mobilePage.getByText(/Basic local organization was used/).waitFor();

    await mobilePage.locator('#f_solution').selectOption('workflow');
    await mobilePage.getByText(/Process complexity/).click();
    await mobilePage.locator('#f_steps_band').selectOption('2');
    await mobilePage.locator('#f_variation_band').selectOption('1');
    await mobilePage.getByText(/Team and rollout/).click();
    await mobilePage.locator('#f_people_count').fill('3');
    await mobilePage.locator('#f_department_count').fill('2');
    await mobilePage.locator('#f_cadence').selectOption('monthly');
    await mobilePage.locator('#f_handover').selectOption('group');
    await mobilePage.getByRole('button', { name: /Continue/ }).click();

    await mobilePage.locator('#f_systems').fill('Wave');
    await mobilePage.locator('#f_legacy_system_check').selectOption('Standard');
    await mobilePage.getByRole('button', { name: /Continue/ }).click();

    await mobilePage.locator('#f_documentation_readiness').selectOption('Notes or examples');
    await mobilePage.locator('#f_data_preparation_level').selectOption('Some preparation');
    await mobilePage.getByRole('button', { name: /Continue/ }).click();

    await mobilePage.getByRole('button', { name: /Continue/ }).click();
    await mobilePage.locator('#f_responsibility_split').selectOption('aoc');
    await mobilePage.locator('#f_action_mode').selectOption('draft');
    await mobilePage.getByRole('button', { name: /^Standard/ }).click();
    await mobilePage.locator('.check input').check();
    calculationMode = 'server';
    await mobilePage.getByRole('button', { name: /Confirm details & calculate/ }).click();

    await mobilePage.waitForFunction(() => globalThis.AOCJourney.getState().result?.build != null);
    assert.equal(await mobilePage.evaluate(() => globalThis.AOCJourney.getState().step), 7, 'mobile journey reaches the final step');
    assert.equal(await mobilePage.evaluate(() => globalThis.AOCJourney.getState().calculationSource), 'server', 'mobile journey uses the server calculator');
    assert.equal(await mobilePage.locator('#estimateStatus').textContent(), 'SERVER VERIFIED', 'mobile journey displays a verified estimate');
    assert.equal(
      await mobilePage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      true,
      'completed mobile journey has no page-level horizontal overflow',
    );
    if (capture) await mobilePage.screenshot({ path: path.join(artifactsDirectory, 'estimator-mobile-journey.png'), fullPage: true });
    await mobilePage.close();

    assert.deepEqual(errors, [], `browser errors: ${errors.join('; ')}`);
    console.log('PASS: React desktop and complete mobile browser journeys, conditional fields, scope preservation, server/local calculation paths, fixture totals, stale recalculation, protected area changes, and mobile overflow.');
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  server.close(() => process.exit(1));
});
