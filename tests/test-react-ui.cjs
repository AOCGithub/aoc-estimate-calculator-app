const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright-core');
const JourneyCalculation = require('../public/journey-calculation.js');
const JourneyContract = require('../public/journey-contract.js');

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
  '.png': 'image/png',
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
    const performanceSource = fs.readFileSync(path.resolve(__dirname, '../src/lib/speedInsights.js'), 'utf8');
    const { performanceOrigin, sanitizePerformanceEvent } = await import(`data:text/javascript;base64,${Buffer.from(performanceSource).toString('base64')}`);
    const performanceEvent = { type: 'vital', url: `${performanceOrigin}/?email=private@example.test&description=private#answer`, route: '/private' };
    assert.deepEqual(sanitizePerformanceEvent(performanceEvent), { type: 'vital', url: `${performanceOrigin}/`, route: '/' }, 'performance URLs exclude parameters, fragments and dynamic paths');
    assert.ok(performanceEvent.url.includes('private@example.test'), 'sanitization does not mutate the original event');
    for (const url of ['invalid', 'http://127.0.0.1:4175/', 'https://preview.vercel.app/', 'https://estimate.alwaysopencommerce.com.evil.test/']) {
      assert.equal(sanitizePerformanceEvent({ type: 'vital', url }), null, 'nonproduction or malformed performance events are dropped');
    }
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    assert.equal(await page.locator('script[data-sdkn]').count(), 0, 'local builds do not send performance data');
    const faviconLink = page.locator('link[rel="icon"]');
    assert.equal(await faviconLink.getAttribute('href'), '/favicon.png', 'favicon is hosted locally to respect the existing security policy');
    assert.equal(await faviconLink.getAttribute('type'), 'image/png');
    const faviconResponse = await page.request.get(`http://127.0.0.1:${port}/favicon.png`);
    assert.equal(faviconResponse.status(), 200);
    assert.equal(faviconResponse.headers()['content-type'], 'image/png');
    assert.deepEqual(await faviconResponse.body(), fs.readFileSync(path.resolve(__dirname, '../public/favicon.png')), 'built app serves the original AOC favicon');
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
    assert.equal(await page.locator('.description-actions').evaluate(element => getComputedStyle(element).flexDirection), 'row', 'desktop description buttons retain their existing layout');
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
    assert.equal(await page.locator('#tier_requirement').textContent(), 'To discuss with AOC', 'unpriced support coverage is not silently selected');
    await page.locator('#f_delivery_intent').selectOption('limited');
    await page.locator('#f_implementation_route').selectOption('project');
    await page.locator('#f_existing_client').selectOption('no');
    await page.locator('#quote-details > summary').click();
    await page.locator('#f_audit_fee').fill('1250');
    await page.getByText('Check an existing audit credit', {exact:true}).click();
    await page.locator('#f_audit_paid').fill('1250');
    await page.locator('#f_audit_sent_date').fill('2020-01-01');
    await page.locator('#f_implementation_acceptance_date').fill('2020-01-10');
    await page.locator('#f_first_implementation_payment_date').fill('2020-01-15');
    await page.locator('#f_audit_accepted_route').selectOption('project');
    await page.locator('#f_audit_credit_used').selectOption('no');
    await page.locator('#f_preparation_fee').fill('0');
    await page.locator('#f_implementation_fee').fill('11500');
    await page.locator('#f_live_training').selectOption('no');
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

    await page.locator('.money').filter({hasText:'$11,500'}).waitFor();
    await page.getByText('Needs scope / quoted fee', {exact:true}).waitFor();
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

    // Current commercial routes: inactive project prices must not become monthly startup fees.
    calculationMode = 'server';
    await page.locator('#f_delivery_intent').selectOption('ongoing');
    await page.locator('#f_implementation_route').selectOption('monthly');
    assert.equal(await page.locator('#f_implementation_fee').count(),0,'project-only quote fields are hidden for monthly programs');
    await page.locator('#f_monthly_plan').selectOption('level1');
    await page.locator('.check input').check();
    await page.getByRole('button',{name:/Confirm details & calculate/}).click();
    await page.waitForFunction(()=>globalThis.AOCJourney.getState().result?.route==='monthly');
    assert.equal((await page.evaluate(()=>globalThis.AOCJourney.getState().result)).credit.status,'review','switching route cannot silently transfer old audit-credit records');
    if(!await page.getByText('Check an existing audit credit',{exact:true}).isVisible()) await page.locator('#quote-details > summary').click();
    if(!await page.locator('#f_audit_accepted_route').isVisible()) await page.getByText('Check an existing audit credit',{exact:true}).click();
    await page.locator('#f_audit_accepted_route').selectOption('monthly');
    await page.getByText('Optional program value comparison',{exact:true}).click();
    await page.locator('#f_comparison_months').fill('12');
    await page.locator('#f_benefit_months').fill('6');
    await page.getByRole('navigation').getByText('Time, costs and value',{exact:true}).click();
    if(!await page.locator('#f_provider_replaced_portion').isVisible()) await page.getByText('Calculate potential value',{exact:true}).click();
    await page.locator('#f_provider_replaced_portion').selectOption('none');
    await page.getByRole('navigation').getByText('Responsibilities and service',{exact:true}).click();
    await page.locator('.check input').check();
    await page.getByRole('button',{name:/Confirm details & calculate/}).click();
    await page.waitForFunction(()=>{const state=globalThis.AOCJourney.getState();return !state.dirty&&!state.calculating&&state.result?.monthly===4000;});
    let program = await page.evaluate(()=>globalThis.AOCJourney.getState().result);
    assert.equal(program.build,null);
    assert.equal(program.projectBalance,null);
    assert.equal(program.comparisonInvestment,48000);
    assert.equal(program.comparisonGross,9600);
    assert.equal(program.monthlyInvoiceAfterCredit,2750);
    assert.equal(await page.getByText('Fixed-project quote and payment illustration',{exact:true}).count(),0);
    assert.equal(await page.locator('#estimateStatus').textContent(),'SERVER VERIFIED · PARTIAL','unknown program hours/blend remain review-needed');
    await page.locator('#f_monthly_plan').selectOption('level2');
    assert.match(await page.locator('#estimateStatus').textContent(),/RECALCULATE/);
    await page.locator('.check input').check();
    await page.getByRole('button',{name:/Confirm details & calculate/}).click();
    await page.waitForFunction(()=>globalThis.AOCJourney.getState().result?.monthly===7000);
    await page.locator('#f_monthly_plan').selectOption('');
    assert.equal(await page.locator('#f_monthly_plan').getAttribute('aria-invalid'),'true');
    await page.locator('.check input').check();
    await page.getByRole('button',{name:/Confirm details & calculate/}).click();
    await page.waitForFunction(()=>globalThis.AOCJourney.getState().result?.monthly===null);
    assert.equal((await page.evaluate(()=>globalThis.AOCJourney.getState().result)).comparisonInvestment,null);
    await page.locator('#f_monthly_plan').selectOption('level1');
    await page.locator('#f_existing_client').selectOption('yes');
    assert.equal(await page.locator('#f_existing_plan_name').isVisible(),true);
    await page.locator('#f_existing_plan_name').fill('Synthetic retained agreement');
    await page.locator('#f_existing_plan_fee').fill('3500');
    await page.locator('#f_retained_existing_fee').fill('2000');
    await page.locator('#f_existing_retained_scope').fill('Retained hosting and other work');
    await page.locator('#f_existing_replaced_scope').fill('Reporting');
    await page.locator('#f_existing_plan_reconciled').selectOption('yes');
    await page.locator('.check input').check();
    await page.getByRole('button',{name:/Confirm details & calculate/}).click();
    await page.waitForFunction(()=>globalThis.AOCJourney.getState().result?.combinedMonthlyCommitment===6000);
    assert.equal((await page.evaluate(()=>globalThis.AOCJourney.getState().result)).cash,0,'agreement fee reduction is not counted again as cash savings');
    await page.locator('#f_retained_existing_fee').fill('');
    await page.locator('.check input').check();
    await page.getByRole('button',{name:/Confirm details & calculate/}).click();
    await page.waitForFunction(()=>globalThis.AOCJourney.getState().result?.combinedMonthlyCommitment===null);
    assert.equal((await page.evaluate(()=>globalThis.AOCJourney.getState().result)).net,null);
    await page.locator('#f_existing_client').selectOption('no');
    assert.equal(await page.locator('#f_existing_plan_name').count(),0,'existing-client questions disappear for a new client');

    assert.equal(await page.locator('#section-picker').isVisible(), false, 'desktop keeps the existing section navigation');
    assert.equal(await page.locator('#sections > button:visible').count(), 7, 'all desktop section buttons remain available');
    const beforeMobileNavigation = await page.evaluate(() => globalThis.AOCJourney.getState());
    for (const width of [320, 360, 390, 430, 768, 950]) {
      await page.setViewportSize({ width, height: 844 });
      assert.ok(await page.getByLabel('Section 7 of 7', {exact:true}).isVisible(), 'small screens show an accessible section selector');
      assert.equal(await page.locator('#sections > button:visible').count(), 0, 'the horizontal strip is replaced rather than clipped');
      assert.equal(await page.locator('#section-picker option').count(), 7, 'all seven sections remain available');
      assert.equal(await page.locator('#sections').evaluate(element => element.scrollWidth <= element.clientWidth), true, `navigation does not scroll sideways at ${width}px`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `page does not overflow at ${width}px`);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    for (let step = 1; step <= 7; step += 1) {
      await page.locator('#section-picker').selectOption(String(step));
      assert.equal(await page.evaluate(() => globalThis.AOCJourney.getState().step), step, 'selector navigates to the requested section');
      assert.ok(await page.getByLabel(`Section ${step} of 7`, {exact:true}).isVisible(), 'progress label follows navigation');
    }
    const afterMobileNavigation = await page.evaluate(() => globalThis.AOCJourney.getState());
    assert.deepEqual(afterMobileNavigation.answers, beforeMobileNavigation.answers, 'changing navigation preserves all answers');
    assert.deepEqual(afterMobileNavigation.result, beforeMobileNavigation.result, 'changing navigation preserves the calculated result');
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      true,
      'mobile layout has no page-level horizontal overflow',
    );
    if (capture) await page.screenshot({ path: path.join(artifactsDirectory, 'estimator-mobile.png'), fullPage: true });

    await page.locator('#section-picker').selectOption('1');
    page.once('dialog', async (dialog) => {
      assert.match(dialog.message(), /clears this estimate/i);
      await dialog.dismiss();
    });
    await page.getByRole('button', { name: 'Orders, inventory, and fulfillment', exact: true }).click();
    assert.equal(await page.evaluate(() => globalThis.AOCJourney.getState().area), 'area0', 'canceling an area change preserves the estimate');

    // Canceling Start over preserves even a calculated estimate; accepting resets it.
    const assertRestart = async (targetPage, accept) => {
      const before = await targetPage.evaluate(() => globalThis.AOCJourney.getState());
      await targetPage.locator('#restart').click();
      const dialog = targetPage.getByRole('dialog', { name: 'Start over?', exact: true });
      await dialog.waitFor({ state: 'visible' });
      assert.equal(await dialog.evaluate(element => element.matches(':modal')), true, 'confirmation blocks interaction with the form');
      assert.equal(await dialog.getByRole('button', { name: 'Keep editing', exact: true }).evaluate(element => element === document.activeElement), true, 'safe action is focused by default');
      assert.equal(await targetPage.evaluate(() => document.body.style.overflow), 'hidden', 'background scrolling is paused');
      assert.deepEqual(await targetPage.evaluate(() => globalThis.AOCJourney.getState()), before, 'opening the prompt does not reset anything');
      await dialog.getByRole('button', { name: accept ? 'Start over' : 'Keep editing', exact: true }).click();
      await dialog.waitFor({ state: 'hidden' });
      assert.equal(await targetPage.locator('#restart').evaluate(element => element === document.activeElement), true, 'focus returns to the triggering button');
      assert.equal(await targetPage.evaluate(() => document.body.style.overflow), '', 'background scrolling is restored');
      if (!accept) {
        assert.deepEqual(await targetPage.evaluate(() => globalThis.AOCJourney.getState()), before, 'Cancel leaves all estimate state unchanged');
        return;
      }
      await targetPage.waitForFunction(() => !globalThis.AOCJourney.getState().area);
      const after = await targetPage.evaluate(() => globalThis.AOCJourney.getState());
      assert.equal(after.step, 1);
      assert.equal(after.area, '');
      assert.equal(after.description, '');
      assert.deepEqual(after.answers, {});
      assert.deepEqual(after.facts, {});
      assert.deepEqual(after.routes, []);
      assert.deepEqual(after.routeOverrides, {});
      assert.deepEqual(after.visible, []);
      assert.deepEqual(after.manualVisible, []);
      assert.deepEqual(after.removedScopeFields, []);
      assert.equal(after.analysis, null);
      assert.equal(after.result, null);
      assert.equal(after.confirmed, false);
      assert.equal(after.working, false);
      assert.equal(after.calculating, false);
      assert.equal(after.analysisError, '');
      assert.equal(after.calculationSource, '');
      assert.equal(await targetPage.locator('#toast').count(), 0, 'reset also clears any stale notification');
    };
    await page.setViewportSize({ width: 1440, height: 1000 });
    assert.ok((await page.evaluate(() => globalThis.AOCJourney.getState())).result, 'reset regression covers a calculated estimate');
    await assertRestart(page, false);
    await assertRestart(page, true);

    for (const width of [1440, 390]) {
      const restartPage = await browser.newPage({ viewport: { width, height: 844 } });
      try {
        await restartPage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
        await assertRestart(restartPage, false);
        await assertRestart(restartPage, true);
        await restartPage.getByRole('button', { name: 'Finance and billing', exact: true }).click();
        assert.equal((await restartPage.evaluate(() => globalThis.AOCJourney.getState())).description, '');
        await assertRestart(restartPage, false);
        await assertRestart(restartPage, true);
        await restartPage.getByRole('button', { name: 'Finance and billing', exact: true }).click();
        await restartPage.getByRole('button', { name: /^Describe the work/ }).click();
        await restartPage.locator('#description').fill('Prepare invoices in Wave for our team to review.');
        await assertRestart(restartPage, false);
        const beforeDismissal = await restartPage.evaluate(() => globalThis.AOCJourney.getState());
        for (const method of ['escape', 'backdrop', 'enter']) {
          await restartPage.locator('#restart').click();
          const prompt = restartPage.getByRole('dialog', { name: 'Start over?', exact: true });
          await prompt.waitFor({ state: 'visible' });
          if (method === 'backdrop') await restartPage.mouse.click(4, 4);
          else await restartPage.keyboard.press(method === 'escape' ? 'Escape' : 'Enter');
          await prompt.waitFor({ state: 'hidden' });
          assert.deepEqual(await restartPage.evaluate(() => globalThis.AOCJourney.getState()), beforeDismissal, `${method} dismisses without clearing answers`);
        }
        for (const key of ['Tab', 'Shift+Tab', 'Tab', 'Tab']) {
          if (!await restartPage.locator('.restart-dialog').isVisible()) await restartPage.locator('#restart').click();
          await restartPage.keyboard.press(key);
          assert.equal(await restartPage.locator('.restart-dialog').evaluate(element => element.contains(document.activeElement) || element === document.activeElement), true, 'keyboard focus stays inside the modal');
        }
        const bounds = await restartPage.locator('.restart-dialog').boundingBox();
        assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width, 'prompt fits the viewport');
        if (capture) await restartPage.screenshot({ path: path.join(artifactsDirectory, `restart-dialog-${width}.png`) });
        await restartPage.keyboard.press('Escape');
        await assertRestart(restartPage, true);

        // A response arriving after a confirmed reset must not repopulate the form.
        await restartPage.getByRole('button', { name: 'Finance and billing', exact: true }).click();
        await restartPage.getByRole('button', { name: /^Describe the work/ }).click();
        await restartPage.locator('#description').fill('Prepare invoices in Wave for our team to review.');
        let releaseRestartAnalysis;
        const restartAnalysisGate = new Promise(resolve => { releaseRestartAnalysis = resolve; });
        await restartPage.route('**/api/journey/analyze', async route => {
          await restartAnalysisGate;
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ localFallback: true }) });
        });
        const restartAnalysisRequest = restartPage.waitForRequest(request => request.url().endsWith('/api/journey/analyze'));
        await restartPage.getByRole('button', { name: /Organize my description/ }).click();
        await restartAnalysisRequest;
        assert.equal((await restartPage.evaluate(() => globalThis.AOCJourney.getState())).working, true);
        await assertRestart(restartPage, false);
        await assertRestart(restartPage, true);
        const resetState = await restartPage.evaluate(() => globalThis.AOCJourney.getState());
        const restartAnalysisResponse = restartPage.waitForResponse(response => response.url().endsWith('/api/journey/analyze'));
        releaseRestartAnalysis();
        await (await restartAnalysisResponse).finished();
        await restartPage.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        assert.deepEqual(await restartPage.evaluate(() => globalThis.AOCJourney.getState()), resetState, 'late AI response cannot undo a confirmed reset');
      } finally { await restartPage.close(); }
    }

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
    assert.equal(await mobilePage.locator('#section-picker option:disabled').count(), 6, 'later sections are still locked until a business area is chosen');
    await mobilePage.getByRole('button', { name: 'Finance and billing', exact: true }).click();
    assert.equal(await mobilePage.locator('#section-picker option:disabled').count(), 0, 'choosing an area unlocks the same seven sections');
    await mobilePage.getByRole('button', { name: /^Describe the work/ }).click();
    assert.equal(await mobilePage.locator('#section-picker').inputValue(), '2', 'next action keeps mobile navigation in sync');
    for (const width of [320, 360, 390, 430, 700]) {
      await mobilePage.setViewportSize({width,height:844});
      const bounds = await mobilePage.locator('.description-actions').evaluate(element => ({
        container: {left:element.getBoundingClientRect().left,width:element.getBoundingClientRect().width},
        buttons: [...element.querySelectorAll('button')].map(button => {
          const rect = button.getBoundingClientRect();
          return {left:rect.left,top:rect.top,width:rect.width,height:rect.height,layoutHeight:button.offsetHeight};
        }),
      }));
      assert.equal(bounds.buttons.length,2);
      for (const button of bounds.buttons) {
        assert.ok(Math.abs(button.width-bounds.container.width)<1, `description action fills the available width at ${width}px`);
        assert.ok(Math.abs(button.left-bounds.container.left)<1, 'full-width actions are left-aligned');
        assert.ok(button.layoutHeight>=48 && button.height>=47.99, 'mobile actions retain a 48px touch target (allowing fractional-pixel rectangle rounding)');
      }
      assert.ok(bounds.buttons[1].top>=bounds.buttons[0].top+bounds.buttons[0].height, 'mobile description actions stack vertically');
      assert.equal(await mobilePage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`full-width buttons do not cause overflow at ${width}px`);
    }
    await mobilePage.setViewportSize({width:390,height:844});
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
    await mobilePage.locator('#f_implementation_route').selectOption('project');
    await mobilePage.locator('#f_existing_client').selectOption('no');
    await mobilePage.locator('#f_action_mode').selectOption('draft');
    await mobilePage.getByRole('button', { name: /^Standard/ }).click();
    await mobilePage.locator('.check input').check();
    calculationMode = 'server';
    await mobilePage.getByRole('button', { name: /Confirm details & calculate/ }).click();

    await mobilePage.waitForFunction(() => globalThis.AOCJourney.getState().result?.build != null);
    assert.equal(await mobilePage.evaluate(() => globalThis.AOCJourney.getState().step), 7, 'mobile journey reaches the final step');
    assert.equal(await mobilePage.evaluate(() => globalThis.AOCJourney.getState().calculationSource), 'server', 'mobile journey uses the server calculator');
    assert.equal(await mobilePage.locator('#estimateStatus').textContent(), 'SERVER VERIFIED · PARTIAL', 'mobile journey calculates a review-needed estimate without inventing quote amounts');
    assert.equal(
      await mobilePage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      true,
      'completed mobile journey has no page-level horizontal overflow',
    );
    if (capture) await mobilePage.screenshot({ path: path.join(artifactsDirectory, 'estimator-mobile-journey.png'), fullPage: true });
    await mobilePage.locator('#f_delivery_intent').selectOption('ongoing');
    await mobilePage.locator('#f_implementation_route').selectOption('monthly');
    await mobilePage.locator('#f_monthly_plan').selectOption('level3');
    await mobilePage.locator('.check input').check();
    await mobilePage.getByRole('button',{name:/Confirm details & calculate/}).click();
    await mobilePage.waitForFunction(()=>globalThis.AOCJourney.getState().result?.monthly===10000);
    assert.equal((await mobilePage.evaluate(()=>globalThis.AOCJourney.getState().result)).audit,null,'mobile program does not invent an audit fee');
    assert.equal(await mobilePage.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,'monthly program has no mobile overflow');
    await assertRestart(mobilePage, false);
    await assertRestart(mobilePage, true);
    await mobilePage.close();

    // The new commercial facts use the same manual-correction protection as all other answers.
    const prefillPage=await browser.newPage({viewport:{width:390,height:844}});
    prefillPage.on('pageerror',error=>errors.push(error.message));
    const commercialDescription="We have selected AOC's Level 1 monthly build program for ongoing development. AOC quoted a fixed audit fee of $900.";
    const commercialAnalysis=JourneyContract.validate({title:'Synthetic monthly program',summary:commercialDescription,solution:'workflow',recommendationReason:'Synthetic fixture',classification:{steps:null,variations:null,decisions:null,reason:'Review'},routes:[],facts:[
      {id:'monthly_plan',value:'level1',quote:"We have selected AOC's Level 1 monthly build program for ongoing development."},
      {id:'audit_fee',value:'900',quote:'AOC quoted a fixed audit fee of $900.'},
    ],relevantFields:[],uncertainties:[]},commercialDescription,'area0');
    await prefillPage.route('**/api/journey/analyze',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({analysis:commercialAnalysis})}));
    await prefillPage.goto(`http://127.0.0.1:${port}/`,{waitUntil:'networkidle'});
    await prefillPage.getByRole('button',{name:'Finance and billing',exact:true}).click();
    await prefillPage.getByRole('button',{name:/^Describe the work/}).click();
    await prefillPage.locator('#description').fill(commercialDescription);
    await prefillPage.getByRole('button',{name:/Organize my description/}).click();
    await prefillPage.waitForFunction(()=>globalThis.AOCJourney.getState().step===3);
    await prefillPage.locator('#section-picker').selectOption('7');
    assert.equal(await prefillPage.locator('#f_implementation_route').inputValue(),'monthly');
    assert.equal(await prefillPage.locator('#f_monthly_plan').inputValue(),'level1');
    await prefillPage.locator('#f_implementation_route').selectOption('project');
    await prefillPage.locator('#quote-details > summary').click();
    await prefillPage.locator('#f_audit_fee').fill('1250');
    await prefillPage.locator('#section-picker').selectOption('2');
    await prefillPage.getByRole('button',{name:/Organize my description/}).click();
    await prefillPage.waitForFunction(()=>globalThis.AOCJourney.getState().step===3);
    const correctedCommercial=await prefillPage.evaluate(()=>globalThis.AOCJourney.getState().answers);
    assert.equal(correctedCommercial.implementation_route,'project','AI reorganization keeps a manual implementation-route correction');
    assert.equal(correctedCommercial.audit_fee,1250,'AI reorganization keeps a manually corrected quote reference');
    assert.equal(correctedCommercial.agreed_monthly_hours,undefined,'unknown agreement hours stay blank');
    await prefillPage.close();

    // Optional scope questions can be added, removed and explicitly added again.
    const questionPage = await browser.newPage({viewport:{width:390,height:844}});
    questionPage.on('pageerror',error=>errors.push(error.message));
    const questionDialogs = [];
    let questionDialogAction = 'dismiss';
    questionPage.on('dialog',async dialog=>{
      questionDialogs.push(dialog.message());
      await dialog[questionDialogAction]();
    });
    const questionState = () => questionPage.evaluate(()=>globalThis.AOCJourney.getState());
    const goToQuestionStep = step => questionPage.locator('#section-picker').selectOption(String(step));
    const addQuestion = async id => {
      const current = await questionState();
      const definition = require('../public/approved-bank.js').areas.find(area=>area.id===current.area).fields.find(candidate=>candidate.id===id);
      if(!await questionPage.getByLabel('Search scope question bank').isVisible()) await questionPage.locator('#scope-question-bank > summary').click();
      await questionPage.getByLabel('Search scope question bank').fill(definition.question);
      await questionPage.locator(`#scope-question-bank [data-field-id="${id}"]`).getByRole('button',{name:'Add',exact:true}).click();
      if(!await questionPage.locator(`#f_${id}`).isVisible()) await questionPage.getByText(/^Review detailed scope/).click();
      await questionPage.locator(`#f_${id}`).waitFor();
    };
    const removeQuestion = async id => {
      await questionPage.locator(`#f_${id}`).locator('..').getByRole('button',{name:/^Remove question:/}).click();
      if (!await questionPage.locator(`#f_${id}`).count()) {
        await questionPage.locator(`#scope-question-bank [data-field-id="${id}"]`).waitFor({ state: 'visible' });
      }
    };
    try {
      await questionPage.goto(`http://127.0.0.1:${port}/`,{waitUntil:'networkidle'});
      await questionPage.getByRole('button',{name:'Paid advertising',exact:true}).click();
      await questionPage.getByRole('button',{name:/^Describe the work/}).click();
      const questionDescription='We use Meta for paid advertising and need Reporting for our staff to review. This synthetic test must preserve manually edited answers.';
      await questionPage.locator('#description').fill(questionDescription);
      await questionPage.getByRole('button',{name:/Continue with editable fields/}).click();
      await addQuestion('ads_003');
      assert.equal(await questionPage.locator('#scope-question-bank [data-field-id="ads_003"]').count(),0,'added question leaves the available bank');
      await removeQuestion('ads_003');
      assert.equal(questionDialogs.length,0,'blank optional question can be removed without a destructive-answer prompt');
      assert.equal(await questionPage.locator('#f_ads_003').count(),0);
      assert.ok(await questionPage.locator('#scope-question-bank [data-field-id="ads_003"]').isVisible(),'removed question returns to the bank');
      assert.equal(await questionPage.getByLabel('Search scope question bank').evaluate(element=>element===document.activeElement),true,'focus returns to the question bank');
      await addQuestion('ads_003');
      assert.equal(await questionPage.locator('#f_ads_003').inputValue(),'','re-adding starts with a blank answer');
      await questionPage.locator('#f_ads_003').fill('Meta');
      const beforeCancel = await questionState();
      await removeQuestion('ads_003');
      assert.match(questionDialogs.at(-1),/clear its answer/);
      assert.deepEqual(await questionState(),beforeCancel,'canceling removal leaves all state untouched');
      await addQuestion('ads_002');
      await questionPage.locator('#f_ads_002').fill('Reporting');

      await questionPage.locator('#f_solution').selectOption('workflow');
      if(!await questionPage.locator('#f_steps_band').isVisible()) await questionPage.getByText(/Process complexity/).click();
      await questionPage.locator('#f_steps_band').selectOption('2'); await questionPage.locator('#f_variation_band').selectOption('2');
      if(!await questionPage.locator('#f_people_count').isVisible()) await questionPage.getByText(/Team and rollout/).click();
      await questionPage.locator('#f_people_count').fill('2'); await questionPage.locator('#f_department_count').fill('1');
      await questionPage.locator('#f_handover').selectOption('group'); await questionPage.locator('#f_cadence').selectOption('weekly');
      if(!await questionPage.locator('#f_capability_count').isVisible()) await questionPage.getByText('3. Marketing scope',{exact:true}).click();
      for(const id of ['capability_count','brand_count','language_count']) await questionPage.locator(`#f_${id}`).fill('1');
      await questionPage.locator('#f_delivery_mode').selectOption('maintenance');
      assert.equal(await questionPage.locator('.required-section .remove-question').count(),0,'required core questions never get removal controls');
      await goToQuestionStep(4);
      await questionPage.locator('#f_systems').fill('Meta Ads'); await questionPage.locator('#f_legacy_system_check').selectOption('Standard');
      assert.equal(await questionPage.locator('#mainPanel .remove-question').count(),0,'shared app questions cannot be removed through category controls');
      await goToQuestionStep(5);
      await questionPage.locator('#f_documentation_readiness').selectOption('Notes or examples'); await questionPage.locator('#f_data_preparation_level').selectOption('Some preparation');
      assert.equal(await questionPage.locator('#mainPanel .remove-question').count(),0,'shared data questions retain their normal controls');
      await goToQuestionStep(7);
      for(const [id,value] of Object.entries({responsibility_split:'client',action_mode:'draft',delivery_intent:'limited',implementation_route:'project',existing_client:'no'})) await questionPage.locator(`#f_${id}`).selectOption(value);
      await questionPage.locator('.check input').check();
      await questionPage.getByRole('button',{name:/Confirm details & calculate/}).click();
      await questionPage.waitForFunction(()=>{const state=globalThis.AOCJourney.getState();return !state.dirty&&!state.calculating&&state.calculationSource==='server';});
      const beforeRemoval = await questionState();
      await goToQuestionStep(3);
      if(!await questionPage.locator('#f_ads_003').isVisible()) await questionPage.getByText(/^Review detailed scope/).click();
      questionDialogAction='accept';
      await removeQuestion('ads_003');
      const removed = await questionState();
      assert.ok(await questionPage.locator('#scope-question-bank [data-field-id="ads_003"]').isVisible(),'removed question is shown even when a different search was active');
      assert.equal(removed.answers.ads_003,undefined);
      assert.equal(removed.facts.ads_003,undefined);
      assert.equal(removed.answers.ads_002,'Reporting','other added answers are preserved');
      assert.equal(removed.manualVisible.includes('ads_003'),false);
      assert.equal(removed.visible.includes('ads_003'),false);
      assert.equal(removed.removedScopeFields.includes('ads_003'),true);
      assert.equal(removed.dirty,true); assert.equal(removed.confirmed,false);
      assert.deepEqual(removed.result,beforeRemoval.result,'last result is retained only as explicitly stale');
      assert.match(await questionPage.locator('#estimateStatus').textContent(),/RECALCULATE/);
      await goToQuestionStep(7); await questionPage.locator('.check input').check();
      const afterRemovalRequest=questionPage.waitForRequest(request=>request.url().endsWith('/api/journey/calculate'));
      await questionPage.getByRole('button',{name:/Confirm details & calculate/}).click();
      const sent=(await afterRemovalRequest).postDataJSON();
      assert.equal(sent.answers.ads_003,undefined,'removed answer is not submitted to the calculator');
      assert.equal(sent.answers.ads_002,'Reporting');
      await questionPage.waitForFunction(()=>!globalThis.AOCJourney.getState().dirty&&!globalThis.AOCJourney.getState().calculating);
      assert.deepEqual((await questionState()).result,beforeRemoval.result,'removing scope evidence does not invent or remove pricing coefficients');

      const questionAnalysis=JourneyContract.validate({title:'Synthetic advertising',summary:questionDescription,solution:'workflow',recommendationReason:'Test fixture',classification:{steps:null,variations:null,decisions:null,reason:'Test'},routes:[],facts:[{id:'ads_003',value:'Meta',quote:'Meta'},{id:'ads_002',value:'Reporting',quote:'Reporting'}],relevantFields:['ads_003','ads_002'],uncertainties:[]},questionDescription,'area10');
      await questionPage.route('**/api/journey/analyze',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({analysis:questionAnalysis})}));
      const reorganizeQuestions=async()=>{
        await goToQuestionStep(2); await questionPage.getByRole('button',{name:/Organize my description/}).click();
        await questionPage.waitForFunction(()=>globalThis.AOCJourney.getState().step===3&&!globalThis.AOCJourney.getState().working);
      };
      await reorganizeQuestions();
      const afterAI=await questionState();
      assert.equal(afterAI.answers.ads_003,undefined,'AI cannot restore a manually removed answer');
      assert.equal(afterAI.visible.includes('ads_003'),false,'AI cannot restore the removed question');
      assert.equal(afterAI.analysis.facts.some(fact=>fact.id==='ads_003'),false);
      assert.equal(afterAI.answers.ads_002,'Reporting');
      await addQuestion('ads_003');
      assert.equal(await questionPage.locator('#f_ads_003').inputValue(),'','explicit Add does not resurrect the deleted answer');
      assert.equal((await questionState()).removedScopeFields.includes('ads_003'),false);
      await reorganizeQuestions();
      assert.equal((await questionState()).answers.ads_003,'Meta','AI can populate the question after it is explicitly added again');
      if(!await questionPage.locator('#f_ads_003').isVisible()) await questionPage.getByText(/^Review detailed scope/).click();
      await questionPage.locator('#f_ads_003').fill('0');
      const dialogCount=questionDialogs.length;
      await removeQuestion('ads_003');
      assert.equal(questionDialogs.length,dialogCount+1,'explicit zero is still a filled answer requiring confirmation');
      assert.equal((await questionState()).answers.ads_003,undefined);
      assert.equal((await questionState()).facts.ads_003,undefined);
      assert.equal(await questionPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'remove controls fit on mobile');

      // Late asynchronous responses must not undo a removal made in another section.
      await addQuestion('ads_003');
      let releaseCalculation;
      const calculationGate=new Promise(resolve=>{releaseCalculation=resolve;});
      await questionPage.route('**/api/journey/calculate',async route=>{
        const body=route.request().postDataJSON();
        await calculationGate;
        await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({...JourneyCalculation.calculate(body),source:'server'})});
      });
      await goToQuestionStep(7); await questionPage.locator('.check input').check();
      const delayedCalculationRequest=questionPage.waitForRequest(request=>request.url().endsWith('/api/journey/calculate'));
      await questionPage.getByRole('button',{name:/Confirm details & calculate/}).click();
      await delayedCalculationRequest;
      await goToQuestionStep(3);
      if(!await questionPage.locator('#f_ads_003').isVisible()) await questionPage.getByText(/^Review detailed scope/).click();
      await removeQuestion('ads_003');
      const delayedCalculationResponse=questionPage.waitForResponse(response=>response.url().endsWith('/api/journey/calculate'));
      releaseCalculation();
      await (await delayedCalculationResponse).finished();
      await questionPage.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      assert.equal((await questionState()).dirty,true,'late calculation response cannot mark the changed estimate current');
      assert.equal((await questionState()).confirmed,false);
      await questionPage.unroute('**/api/journey/calculate');

      await addQuestion('ads_003');
      await questionPage.locator('#f_ads_003').fill('Meta');
      await questionPage.unroute('**/api/journey/analyze');
      let releaseAnalysis;
      const analysisGate=new Promise(resolve=>{releaseAnalysis=resolve;});
      await questionPage.route('**/api/journey/analyze',async route=>{
        await analysisGate;
        await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({analysis:questionAnalysis})});
      });
      await goToQuestionStep(2);
      const delayedAnalysisRequest=questionPage.waitForRequest(request=>request.url().endsWith('/api/journey/analyze'));
      await questionPage.getByRole('button',{name:/Organize my description/}).click();
      await delayedAnalysisRequest;
      await goToQuestionStep(3);
      if(!await questionPage.locator('#f_ads_003').isVisible()) await questionPage.getByText(/^Review detailed scope/).click();
      await removeQuestion('ads_003');
      assert.equal((await questionState()).working,false,'removing during organization cancels the outdated busy state');
      const delayedAnalysisResponse=questionPage.waitForResponse(response=>response.url().endsWith('/api/journey/analyze'));
      releaseAnalysis();
      await (await delayedAnalysisResponse).finished();
      await questionPage.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      assert.equal((await questionState()).answers.ads_003,undefined,'late AI response cannot restore the removed answer');
      assert.equal((await questionState()).visible.includes('ads_003'),false);

      // Every business-area bank keeps removed questions available for re-adding.
      for(const area of require('../public/approved-bank.js').areas) {
        await goToQuestionStep(1);
        await questionPage.getByRole('button',{name:area.label,exact:true}).click();
        await goToQuestionStep(3);
        if(!await questionPage.getByLabel('Search scope question bank').isVisible()) await questionPage.locator('#scope-question-bank > summary').click();
        await questionPage.getByLabel('Search scope question bank').fill('');
        const first=questionPage.locator('#scope-question-bank .bank-item').first();
        const id=await first.getAttribute('data-field-id');
        await first.getByRole('button',{name:'Add',exact:true}).click();
        if(!await questionPage.locator(`#f_${id}`).isVisible()) await questionPage.getByText(/^Review detailed scope/).click();
        await removeQuestion(id);
        assert.ok(await questionPage.locator(`#scope-question-bank [data-field-id="${id}"]`).isVisible(),`removed question returns in ${area.label}`);
      }
      await goToQuestionStep(1);
      await questionPage.getByRole('button',{name:'Finance and billing',exact:true}).click();
      assert.deepEqual((await questionState()).removedScopeFields,[],'changing business area resets removal overrides');
      await goToQuestionStep(3);
      await questionPage.getByText(/^Review detailed scope/).click();
      await questionPage.getByRole('button',{name:'Create and send invoices',exact:true}).click();
      assert.ok((await questionState()).visible.includes('invoice_volume'));
      await removeQuestion('invoice_volume');
      await questionPage.getByRole('button',{name:'Create and send invoices',exact:true}).click();
      await questionPage.getByRole('button',{name:'Create and send invoices',exact:true}).click();
      assert.equal((await questionState()).visible.includes('invoice_volume'),false,'route suggestions do not silently undo explicit removal');
    } finally { await questionPage.close(); }

    // Load the production build under its real origin using local asset fixtures.
    // No real visitor metrics or network requests are sent to Vercel in this test.
    const performancePage = await browser.newPage();
    performancePage.on('pageerror', error => errors.push(error.message));
    try {
      await performancePage.route(`${performanceOrigin}/**`, async route => {
        const url = new URL(route.request().url());
        if (url.pathname === '/_vercel/speed-insights/script.js') {
          await route.fulfill({ status: 200, contentType: 'text/javascript', body: 'window.__performanceFixtureLoaded = true;' });
          return;
        }
        assert.ok(!url.pathname.includes('/vitals'), 'fixture must not send metrics');
        const response = await performancePage.request.get(`http://127.0.0.1:${port}${url.pathname}`);
        await route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; connect-src 'self'; img-src 'self' data:; object-src 'none'" } });
      });
      await performancePage.goto(`${performanceOrigin}/?email=private@example.test#answer`, { waitUntil: 'networkidle' });
      await performancePage.waitForFunction(() => window.__performanceFixtureLoaded);
      assert.equal(await performancePage.locator('script[data-sdkn="@vercel/speed-insights/react"]').count(), 1, 'production loads exactly one Speed Insights script, including in StrictMode');
      assert.equal(await performancePage.locator('script[data-sdkn]').getAttribute('data-route'), '/');
      const sanitized = await performancePage.evaluate(() => {
        const beforeSend = window.siq.find(([type]) => type === 'beforeSend')[1];
        return beforeSend({ type: 'vital', url: location.href });
      });
      assert.deepEqual(sanitized, { type: 'vital', url: `${performanceOrigin}/`, route: '/' });
      assert.equal(await performancePage.locator('script[src*="/_vercel/insights/"]').count(), 0, 'Web Analytics is not added');
      assert.equal(await performancePage.locator('.area').count(), 12, 'monitoring does not alter the calculator');
    } finally { await performancePage.close(); }

    assert.deepEqual(errors, [], `browser errors: ${errors.join('; ')}`);
    console.log('PASS: React desktop and complete mobile browser journeys, local AOC favicon, reset confirmation/cancellation/late AI protection, conditional fields, scope preservation, server/local calculation paths, fixture totals, stale recalculation, protected area changes, and mobile overflow.');
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  server.close(() => process.exit(1));
});
