const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const target = process.env.AOC_PROFILE_TEST_URL || 'http://127.0.0.1:5174';
const identity = { name: 'Company Profile Test', company: 'Company Facts Example', website: 'example.com', role: 'Testing', businessEmail: 'company-facts@example.com' };
async function entry(page, changes = {}) {
  const profile = { ...identity, ...changes };
  for (const [key, label] of Object.entries({ name: 'Your name', company: 'Company', website: 'Company website', role: 'Your role', businessEmail: 'Business email' })) await page.getByLabel(label, { exact: true }).fill(profile[key]);
  assert.equal(await page.getByRole('checkbox', { name: /Remember my business/ }).isChecked(), false);
  await page.getByRole('button', { name: 'Continue to calculator' }).click();
  await page.locator('.area').first().waitFor();
  await page.getByRole('button', { name: 'Finance & billing', exact: true }).click();
}
async function section(page, step) {
  if (await page.locator('#section-picker').isVisible()) await page.locator('#section-picker').selectOption(String(step));
  else await page.locator('#sections > button').nth(step - 1).click();
}
async function panel(page) {
  const panel = page.locator('.profile-company-panel');
  if (!(await panel.evaluate(element => element.open))) await panel.locator(':scope > summary').click();
  return panel;
}
async function review(page) {
  const area = await panel(page);
  await area.getByRole('button', { name: 'Review company profile', exact: true }).click();
  await area.getByText('Reuse relevant facts', { exact: true }).waitFor();
  return area;
}
async function end(page) {
  await page.getByRole('button', { name: 'End session', exact: true }).click();
  await page.getByRole('heading', { name: 'Your business details', exact: true }).waitFor();
}
async function saveSelected(area) {
  await area.getByRole('checkbox', { name: 'Save the selected company facts and removals to my profile for future estimates (optional).', exact: true }).check();
  await area.getByRole('button', { name: 'Save selected company facts', exact: true }).click();
  await area.getByRole('status').filter({ hasText: 'Company profile updated.' }).waitFor();
}
async function applySelected(area) {
  await area.getByRole('checkbox', { name: 'I confirm the selected facts belong to this company and still apply to this estimate.', exact: true }).check();
  await area.getByRole('button', { name: 'Use selected facts', exact: true }).click();
  await area.getByRole('status').filter({ hasText: 'Selected facts applied' }).waitFor();
}
const saved = async page => (await page.request.get(target + '/api/client-profile')).json();
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    for (const width of [1440, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
      const page = await context.newPage();
      const errors = [];
      let writes = 0, paidCalls = 0;
      page.on('pageerror', error => errors.push(error.message));
      await context.route('**/api/**', async route => {
        const request = route.request(), pathname = new URL(request.url()).pathname;
        if (pathname === '/api/client-profile' && request.method() === 'POST') writes++;
        if (pathname === '/api/access/verify') assert.equal(request.postDataJSON().saveData, false);
        if (request.method() === 'POST' && ['/api/journey/analyze', '/api/journey/correct', '/api/voice/session'].includes(pathname)) { paidCalls++; return route.abort(); }
        return route.continue();
      });
      try {
        await page.goto(target, { waitUntil: 'networkidle' });
        await entry(page);
        await section(page, 4);
        await page.locator('#f_systems').fill('Wave, Google Sheets');
        let area = await panel(page);
        assert.equal(await area.getByRole('checkbox', { name: /^Save the selected company/ }).isChecked(), false);
        await area.getByRole('checkbox', { name: /^Apps and software: Wave/ }).check();
        assert.equal(await area.getByRole('button', { name: 'Save selected company facts', exact: true }).isDisabled(), true);
        assert.equal(writes, 0, 'Selection without consent does not save.');
        await saveSelected(area);
        let snapshot = await saved(page);
        assert.equal(snapshot.profile.company, identity.company);
        assert.equal(snapshot.facts.systems.value, 'Wave, Google Sheets');
        assert.equal(snapshot.facts.systems.source.area, 'area0');
        assert.equal(await area.getByRole('checkbox', { name: /^Save the selected company/ }).isChecked(), false, 'Consent resets after a save.');
        await page.locator('#f_systems').fill('HubSpot');
        assert.equal((await saved(page)).facts.systems.value, 'Wave, Google Sheets', 'Changed answers do not silently update profiles.');
        // A concurrent profile update makes the displayed snapshot stale.
        const external = await page.request.post(target + '/api/client-profile', { headers: { origin: target }, data: {
          profile: { ...snapshot.profile, role: 'Updated in another tab' }, expectedRevision: snapshot.revision, consent: true, confirmed: true,
        } });
        assert.equal(external.status(), 200);
        await area.getByRole('checkbox', { name: /^Apps and software: HubSpot/ }).check();
        await area.getByRole('checkbox', { name: /^Save the selected company/ }).check();
        await area.getByRole('button', { name: 'Save selected company facts', exact: true }).click();
        await area.getByRole('alert').filter({ hasText: 'profile changed' }).waitFor();
        assert.equal(await page.locator('#f_systems').inputValue(), 'HubSpot');
        assert.equal((await saved(page)).facts.systems.value, 'Wave, Google Sheets');
        await review(page);
        // Save an information-location fact without changing the existing apps.
        await section(page, 5);
        await page.locator('#f_data_information_location').selectOption('Shared files');
        area = await review(page);
        await area.getByRole('checkbox', { name: /^Where information is kept: Shared files/ }).check();
        await saveSelected(area);
        snapshot = await saved(page);
        assert.equal(snapshot.profile.role, 'Updated in another tab', 'Saving facts does not overwrite newer identity details.');
        assert.ok(snapshot.facts.systems);
        assert.equal(snapshot.facts.data_information_location.value, 'Shared files');
        await end(page);
        await entry(page);
        await section(page, 4);
        assert.equal(await page.locator('#f_systems').inputValue(), '', 'Company facts are not applied on entry.');
        area = await review(page);
        assert.equal(await area.getByRole('checkbox', { name: /^I confirm the selected facts/ }).isChecked(), false);
        const appFacts = area.getByRole('checkbox', { name: /^Apps and software: Wave/ }).first();
        await appFacts.check();
        assert.equal(await area.getByRole('button', { name: 'Use selected facts', exact: true }).isDisabled(), true);
        await applySelected(area);
        assert.equal(await page.locator('#f_systems').inputValue(), 'Wave, Google Sheets');
        assert.equal(await page.locator('label[for="f_systems"] .filled').textContent(), 'From confirmed profile');
        assert.equal(await page.evaluate(() => AOCJourney.getState().answers.workspace_context), undefined, 'Unselected account context stays blank.');
        for (const id of ['responsibility_split', 'management', 'tier', 'handover', 'legacy_system_check']) {
          assert.equal(await page.evaluate(key => Object.hasOwn(AOCJourney.getState().answers, key), id), false, `${id} is not restored from the profile`);
        }
        await page.locator('#f_systems').fill('');
        assert.equal(await appFacts.isDisabled(), true, 'An explicitly cleared answer cannot be reintroduced.');
        await page.locator('#f_systems').fill('Wave');
        await page.locator('#f_workspace_context').selectOption('google_workspace');
        await page.locator('#f_ai_account_context').selectOption('chatgpt_business');
        await section(page, 5);
        area = await review(page);
        await area.getByRole('checkbox', { name: /^Where information is kept: Shared files/ }).check();
        await applySelected(area);
        assert.equal(await page.locator('#f_data_information_location').inputValue(), 'Shared files');
        await page.locator('#f_documentation_readiness').selectOption('Notes or examples');
        await page.locator('#f_data_preparation_level').selectOption('partial');
        await section(page, 3);
        await page.getByText('Process complexity', { exact: false }).click();
        await page.locator('#f_steps_band').selectOption('3');
        await page.locator('#f_variation_band').selectOption('3');
        await page.getByText('Team and rollout', { exact: false }).click();
        for (const id of ['people_count', 'department_count']) await page.locator('#f_' + id).fill(id === 'people_count' ? '3' : '2');
        await page.locator('#f_cadence').selectOption('monthly');
        await page.getByText('Action and review approach', { exact: true }).click();
        await page.locator('#f_action_mode').selectOption('draft');
        await section(page, 6);
        await page.locator('#f_team_time').fill('40');
        await page.locator('#f_blended_hourly_cost').fill('50');
        await section(page, 7);
        await page.locator('.check input').check();
        await page.getByRole('button', { name: /Confirm details & calculate/ }).click();
        await page.waitForFunction(() => AOCJourney.getState().calculationSource === 'server' && !AOCJourney.getState().dirty);
        const currentAnswers = await page.evaluate(() => AOCJourney.getState().answers);
        const expected = require('../../public/journey-calculation.js').calculate({ area: 'area0', answers: currentAnswers, confirmed: true }).result;
        assert.deepEqual(await page.evaluate(() => AOCJourney.getState().result), expected);
        await page.locator('.result-download').scrollIntoViewIfNeeded();
        assert.equal(await page.locator('.result-download').evaluate(element => {
          const button = element.getBoundingClientRect();
          const card = element.closest('.estimate-card').getBoundingClientRect();
          return button.top >= card.top && button.bottom <= card.bottom;
        }), true, 'The download action is not clipped by the result details.');
        if (process.argv.includes('--capture')) await page.locator('.estimate-aside').screenshot({ path: `artifacts/redesign-result-${width}.png` });
        // Applying another confirmed fact marks the old result stale.
        snapshot = await saved(page);
        const updated = await page.request.post(target + '/api/client-profile', { headers: { origin: target }, data: {
          profile: snapshot.profile, consent: true, confirmed: true, expectedRevision: snapshot.revision, area: 'area0',
          facts: { data_preparation_owner: { value: 'Our team', source: { kind: 'client_entry' } } },
        } });
        assert.equal(updated.status(), 200);
        await section(page, 5);
        area = await review(page);
        await area.getByRole('checkbox', { name: /^Who prepares missing information: Our team/ }).check();
        await applySelected(area);
        assert.equal(await page.evaluate(() => AOCJourney.getState().dirty), true);
        assert.match(await page.locator('#estimateStatus').textContent(), /RECALCULATE/);
        await page.screenshot({ path: `artifacts/company-profile-reuse-${width}.png`, fullPage: true });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        // Explicit removal only changes the selected stored fact, not current answers.
        await area.getByText('Remove outdated facts', { exact: true }).click();
        await area.getByRole('checkbox', { name: 'Remove saved who prepares missing information', exact: true }).check();
        await saveSelected(area);
        assert.equal((await saved(page)).facts.data_preparation_owner, undefined);
        assert.equal(await page.evaluate(() => AOCJourney.getState().answers.data_preparation_owner), 'Our team');
        await end(page);
        await entry(page, { company: 'Different Current Company' });
        await section(page, 5);
        area = await panel(page);
        await area.getByRole('button', { name: 'Review company profile', exact: true }).click();
        await area.getByRole('alert').filter({ hasText: 'different client details' }).waitFor();
        assert.equal(await page.locator('#f_data_information_location').inputValue(), '');
        assert.equal((await saved(page)).profile.company, identity.company);
        assert.equal(paidCalls, 0);
        assert.deepEqual(errors, []);
        console.log(`PASS: ${width}px optional company facts, provenance, unchecked consent, selected reuse, current/cleared answers, stale updates, identity separation, selective removal, server calculation and stale-result invalidation.`);
      } finally {
        const status = await context.request.get(target + '/api/client-profile/status').then(response => response.json()).catch(() => ({}));
        await context.request.delete(target + '/api/client-profile', { headers: { origin: target, 'if-match': status.revision || '' } }).catch(() => {});
        await context.close();
      }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
