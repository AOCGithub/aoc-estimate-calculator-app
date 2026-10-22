const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright-core');

if (!process.argv.includes('--live')) {
  console.error('This test makes paid AI requests. Run explicitly with: node tests/test-production-ai.cjs --live');
  process.exit(1);
}

const baseUrl = 'https://estimate.alwaysopencommerce.com';
const caseFilterIndex = process.argv.indexOf('--case');
const caseFilter = caseFilterIndex === -1 ? '' : process.argv[caseFilterIndex + 1];
if (caseFilterIndex !== -1 && (!caseFilter || caseFilter.startsWith('--'))) throw new Error('--case requires a case-name substring.');
const executablePath = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].find((candidate) => candidate && fs.existsSync(candidate));
if (!executablePath) throw new Error('Set CHROME_PATH to an installed Chromium browser.');

const report = {
  testedAt: new Date().toISOString(),
  target: baseUrl,
  syntheticDataOnly: true,
  providerRequests: 0,
  applicationBundle: null,
  cases: [],
};
let currentObservation = null;

async function startPage(browser, area, mobile = false) {
  const page = await browser.newPage({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 } });
  page.setDefaultTimeout(10000);
  const response = await page.goto(baseUrl, { waitUntil: 'networkidle' });
  assert.equal(response.status(), 200);
  const html = await response.text();
  const bundle = html.match(/src="([^\"]*\/assets\/index-[^\"]+\.js)"/)?.[1];
  if (report.applicationBundle && bundle !== report.applicationBundle) throw new Error('Production changed during testing.');
  report.applicationBundle = bundle;
  await page.getByRole('button', { name: area, exact: true }).click();
  await page.getByRole('button', { name: /^Describe the work/ }).click();
  return page;
}

async function stateOf(page) {
  return page.evaluate(() => globalThis.AOCJourney.getState());
}

async function organize(page, description, live = true) {
  await page.locator('#description').fill(description);
  const responsePromise = page.waitForResponse((response) => response.url() === `${baseUrl}/api/journey/analyze`, { timeout: 65000 });
  const started = Date.now();
  if (live) report.providerRequests += 1;
  await page.getByRole('button', { name: /Organize my description/ }).click();
  const response = await responsePromise;
  let data;
  try { data = await response.json(); } catch { data = null; }
  await page.waitForFunction(() => globalThis.AOCJourney.getState().step === 3 && !globalThis.AOCJourney.getState().working, null, { timeout: 65000 });
  const state = await stateOf(page);
  currentObservation = { answers: state.answers, extractedFacts: data?.analysis?.facts || [] };
  if (live) {
    assert.equal(response.status(), 200, 'production AI endpoint returns HTTP 200');
    assert.ok(data?.analysis, 'provider returns structured analysis');
    assert.notEqual(data.localFallback, true);
    assert.notEqual(state.analysis?.localFallback, true, 'browser applies the live AI result');
    assert.ok(state.analysis?.title);
    for (const fact of data.analysis.facts) {
      assert.ok(description.includes(fact.quote), `fact ${fact.id} has exact description evidence`);
    }
  }
  assert.equal(state.description, description, 'description is preserved');
  assert.equal(await page.locator('#organizing-status').count(), 0, 'busy state clears after response');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'no horizontal overflow');
  return { state, elapsedMs: Date.now() - started, status: response.status(), factIds: data?.analysis?.facts.map((fact) => fact.id) || [] };
}

function noInventedValues(answers, ids) {
  for (const id of ids) assert.ok(answers[id] == null || answers[id] === '' || (Array.isArray(answers[id]) && answers[id].length === 0), `${id} should remain unknown; received ${JSON.stringify(answers[id])}`);
}

async function openFieldGroup(page, field, group) {
  if (!await page.locator(`#f_${field}`).isVisible()) await page.getByText(group, { exact: false }).click();
}

async function runCase(name, callback) {
  if (caseFilter && !name.toLowerCase().includes(caseFilter.toLowerCase())) return;
  currentObservation = null;
  console.log(`RUN: ${name}`);
  try {
    const details = await callback();
    report.cases.push({ name, status: 'PASS', ...details });
    console.log(`PASS: ${name}`);
  } catch (error) {
    report.cases.push({ name, status: 'FAIL', error: error.message, observation: currentObservation });
    console.log(`FAIL: ${name}: ${error.message}`);
  }
}

(async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    await runCase('Finance prefill and reorganization with manual corrections', async () => {
      const page = await startPage(browser, 'Finance and billing');
      try {
        const first = await organize(page, 'We prepare 20 invoices every month in Wave. 3 people in 2 teams do the work. We have notes and examples with some preparation needed. AOC manages it and prepares drafts for our team to approve. The same billing rules apply each month.');
        assert.deepEqual(first.state.answers.systems, ['Wave']);
        assert.equal(first.state.answers.people_count, 3);
        assert.equal(first.state.answers.department_count, 2);
        assert.equal(first.state.answers.cadence, 'monthly');
        assert.equal(first.state.answers.responsibility_split, 'aoc');
        assert.equal(first.state.answers.action_mode, 'draft');
        noInventedValues(first.state.answers, ['tier', 'team_time', 'blended_hourly_cost', 'incremental_software_cost']);

        await openFieldGroup(page, 'people_count', 'Team and rollout');
        await page.locator('#f_people_count').fill('5');
        await page.getByText(/Review detailed scope/).click();
        const reminderRoute = page.getByRole('button', { name: 'Send payment reminders', exact: true });
        if (await reminderRoute.getAttribute('aria-pressed') !== 'true') await reminderRoute.click();
        await page.getByRole('navigation').getByText('Describe the work', { exact: true }).click();
        const second = await organize(page, 'We now prepare 30 invoices each month in Wave. AOC manages the process and prepares drafts for our team to approve before sending. Use the same billing rules each month.');
        assert.equal(second.state.answers.people_count, 5, 'manually corrected people count survives reorganization');
        assert.ok(second.state.routes.includes('Send payment reminders'), 'manually selected responsibility is preserved');
        noInventedValues(second.state.answers, ['department_count', 'documentation_readiness', 'data_preparation_level', 'tier']);
        return { elapsedMs: [first.elapsedMs, second.elapsedMs], checks: ['explicit facts', 'unknown ROI and coverage blank', 'manual answer retained', 'manual route retained', 'obsolete AI facts removed'] };
      } finally { await page.close(); }
    });

    await runCase('Customer support agent prefill on mobile', async () => {
      const page = await startPage(browser, 'Customer service and returns', true);
      try {
        const result = await organize(page, 'We need an AI agent to use approved policy documents to judge which customer requests need escalation and draft replies in Help Scout. 4 people in 1 support team handle this daily. Our team manages it. A person must approve every reply. We do not know the additional software costs yet.');
        assert.equal(result.state.answers.solution, 'agent');
        assert.ok(result.state.answers.systems.includes('Help Scout'));
        assert.equal(result.state.answers.people_count, 4);
        assert.equal(result.state.answers.department_count, 1);
        assert.equal(result.state.answers.cadence, 'daily');
        assert.equal(result.state.answers.responsibility_split, 'client');
        assert.equal(result.state.answers.management, 'no');
        assert.equal(result.state.answers.action_mode, 'draft');
        noInventedValues(result.state.answers, ['incremental_software_cost', 'tier', 'blended_hourly_cost']);
        return { elapsedMs: result.elapsedMs, checks: ['agent recommendation', 'support facts', 'approval boundary', 'unknown costs blank', 'mobile overflow'] };
      } finally { await page.close(); }
    });

    for (const scenario of [
      {
        name: 'automatic drafting with human review',
        description: 'We want an AI agent to automatically draft customer replies in Help Scout using our policy documents. Our staff will review each draft and send the replies themselves. The agent must not send messages or change customer records.',
        expected: 'draft',
      },
      {
        name: 'system sends after approval',
        description: 'We need an AI agent in Help Scout to draft replies using our policy documents. After a staff member approves a draft, the agent sends the approved reply to the customer. It must not send anything before approval.',
        expected: 'approved',
      },
      {
        name: 'approval alone leaves execution unknown',
        description: 'We need help with customer support in Help Scout. A person must approve every reply. We have not decided what the AI system should do or whether it should prepare drafts or send messages.',
        expected: null,
      },
    ]) {
      await runCase(`Customer support action boundary: ${scenario.name}`, async () => {
        const page = await startPage(browser, 'Customer service and returns');
        try {
          const result = await organize(page, scenario.description);
          if (scenario.expected === null) noInventedValues(result.state.answers, ['action_mode']);
          else assert.equal(result.state.answers.action_mode, scenario.expected);
          await page.getByRole('navigation').getByText('Responsibilities and service', { exact: true }).click();
          assert.equal(await page.locator('#f_action_mode').inputValue(), scenario.expected || '', 'editable field matches the supported system role');
          assert.equal(await page.locator('#f_action_mode').isEnabled(), true);
          return { elapsedMs: result.elapsedMs, checks: ['draft versus execution boundary', 'editable field matches prefill', 'unsupported action remains blank'] };
        } finally { await page.close(); }
      });
    }

    await runCase('Paid advertising prefill and counts', async () => {
      const page = await startPage(browser, 'Paid advertising');
      try {
        const result = await organize(page, 'We use Meta Ads and Google Ads for 1 brand in 1 language. 2 people in 1 marketing team prepare a weekly performance report. We want reporting and approved campaign updates as 2 capabilities in one connected workflow. Monthly ad spend is $5,000. AOC should manage the process. Make changes only after our approval. We have not chosen support coverage or estimated additional software costs.');
        assert.ok(result.state.answers.systems.includes('Meta Ads'));
        assert.ok(result.state.answers.systems.includes('Google Ads'));
        assert.equal(result.state.answers.brand_count, 1);
        assert.equal(result.state.answers.language_count, 1);
        assert.equal(result.state.answers.capability_count, 2);
        assert.equal(result.state.answers.people_count, 2);
        assert.equal(result.state.answers.responsibility_split, 'aoc');
        assert.equal(result.state.answers.action_mode, 'approved');
        noInventedValues(result.state.answers, ['tier', 'incremental_software_cost', 'replacement_provider_cost', 'software_replaced_cost']);
        return { elapsedMs: result.elapsedMs, checks: ['named advertising systems', 'explicit marketing counts', 'approval boundary', 'ad spend not treated as savings or software usage'] };
      } finally { await page.close(); }
    });

    await runCase('SEO prefill with explicit zero and recurring quantities', async () => {
      const page = await startPage(browser, 'SEO and GEO');
      try {
        const result = await organize(page, 'We need one connected SEO system for 1 WordPress website, 1 language and 1 target market. Initial work includes 0 pages and 20 keywords. AOC will manage production: 4 pages worked on per month and 2 articles produced per month. 2 people in 1 team review drafts before publishing. We have not selected a service tier.');
        assert.ok(result.state.answers.systems.includes('WordPress'));
        assert.equal(result.state.answers.brand_count, 1);
        assert.equal(result.state.answers.language_count, 1);
        assert.equal(result.state.answers.market_count, 1);
        assert.equal(result.state.answers.initial_pages, 0);
        assert.equal(result.state.answers.keyword_count, 20);
        assert.equal(result.state.answers.monthly_pages, 4);
        assert.equal(result.state.answers.monthly_articles, 2);
        assert.equal(result.state.answers.delivery_mode, 'managed');
        noInventedValues(result.state.answers, ['tier', 'team_time', 'blended_hourly_cost', 'incremental_software_cost']);
        return { elapsedMs: result.elapsedMs, checks: ['explicit zero retained', 'initial versus recurring scope', 'unknown coverage and ROI blank'] };
      } finally { await page.close(); }
    });

    await runCase('Incomplete description leaves missing facts blank', async () => {
      const page = await startPage(browser, 'Another area / several areas / not sure');
      try {
        const result = await organize(page, 'Our team repeats administrative work and wants to reduce manual effort. We do not yet know the systems, people count, number of departments, frequency, costs, or who should manage it. Please help us identify the missing details.');
        noInventedValues(result.state.answers, ['systems', 'people_count', 'department_count', 'cadence', 'responsibility_split', 'management', 'tier', 'team_time', 'blended_hourly_cost', 'incremental_software_cost']);
        assert.ok(result.state.analysis.uncertainties.length > 0);
        return { elapsedMs: result.elapsedMs, checks: ['missing facts blank', 'uncertainties surfaced', 'editable form remains available'] };
      } finally { await page.close(); }
    });

    await runCase('Explicit management help and manual responsibility correction', async () => {
      const page = await startPage(browser, 'Finance and billing');
      try {
        const description = 'We prepare monthly invoices in Wave. Please help us decide who should manage this process: AOC or our team.';
        const first = await organize(page, description);
        assert.equal(first.state.answers.responsibility_split, 'help', 'explicit management-help request is preserved');
        assert.equal(first.state.answers.management, null, 'help choosing does not assign AOC management');
        await page.getByRole('navigation').getByText('Responsibilities and service', { exact: true }).click();
        await page.locator('#f_responsibility_split').selectOption('client');
        await page.getByRole('navigation').getByText('Describe the work', { exact: true }).click();
        const second = await organize(page, description);
        assert.equal(second.state.answers.responsibility_split, 'client', 'manual responsibility correction survives reorganization');
        assert.equal(second.state.answers.management, 'no');
        return { elapsedMs: [first.elapsedMs, second.elapsedMs], checks: ['explicit management-help request retained', 'ownership stays undecided until chosen', 'manual responsibility correction retained'] };
      } finally { await page.close(); }
    });

    await runCase('Short description validation without an AI request', async () => {
      const page = await startPage(browser, 'Finance and billing');
      let requests = 0;
      page.on('request', (request) => { if (request.url().endsWith('/api/journey/analyze')) requests += 1; });
      try {
        await page.locator('#description').fill('Invoices');
        await page.getByRole('button', { name: /Organize my description/ }).click();
        await page.getByText(/Add a little more detail/, { exact: false }).waitFor();
        assert.equal((await stateOf(page)).step, 2);
        assert.equal(requests, 0);
        assert.equal(await page.locator('#description').inputValue(), 'Invoices');
        assert.equal(await page.getByRole('button', { name: /Continue with editable fields/ }).isEnabled(), true);
        return { checks: ['short input flagged', 'no provider request', 'description preserved', 'manual continuation available'] };
      } finally { await page.close(); }
    });

    for (const failure of ['quota', 'invalid-json']) {
      await runCase(`Browser-simulated ${failure} fallback`, async () => {
        const page = await startPage(browser, 'Finance and billing');
        try {
          await page.route('**/api/journey/analyze', async (route) => {
            await route.fulfill(failure === 'quota'
              ? { status: 429, contentType: 'application/json', body: JSON.stringify({ error: 'Synthetic quota failure' }) }
              : { status: 200, contentType: 'application/json', body: '{' });
          });
          const result = await organize(page, 'We prepare monthly invoices in Wave and need drafts for a person to approve.', false);
          assert.equal(result.state.analysis.localFallback, true);
          assert.ok(result.state.answers.systems.includes('Wave'));
          assert.equal(await page.locator('#f_solution').isEnabled(), true);
          return { checks: ['simulated failure', 'description preserved', 'local fallback', 'editable fields available', 'no provider credits used'] };
        } finally { await page.close(); }
      });
    }
  } finally {
    await browser.close();
    const artifacts = path.resolve(__dirname, '../artifacts');
    fs.mkdirSync(artifacts, { recursive: true });
    const output = path.join(artifacts, caseFilter ? 'production-ai-recheck-results.json' : 'production-ai-results.json');
    fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report, null, 2));
    console.log(`Evidence saved: ${output}`);
  }
  if (report.cases.some((test) => test.status !== 'PASS')) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exitCode = 1; });
