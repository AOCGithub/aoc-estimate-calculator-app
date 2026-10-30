const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright-core');
const { createPreviewServer } = require('../scripts/local-test-pricing.cjs');
const base = require('./fixtures/commercial.cjs');
const fixture = require('./fixtures/local-test-pricing.json');
const executablePath = [process.env.CHROME_PATH, 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find(p => p && fs.existsSync(p));
if (!executablePath) throw Error('Set CHROME_PATH to run the local pricing browser check.');
(async () => {
  const server = createPreviewServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch({ executablePath, headless:true });
    const page = await browser.newPage({ viewport:{width:1440,height:1000} });
    const errors = [], providerRequests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (request.url().includes('api.openai.com')) providerRequests.push(request.url()); });
    const calculate = async () => {
      await page.locator('.check input').check();
      await page.getByRole('button',{name:/Confirm details & calculate/}).click();
      await page.waitForFunction(() => { const s=globalThis.AOCJourney.getState(); return !s.dirty&&!s.calculating&&s.calculationSource==='server'; });
      return page.evaluate(() => globalThis.AOCJourney.getState().result);
    };
    await page.goto(origin, {waitUntil:'networkidle'});
    assert.ok(await page.getByRole('note',{name:'Synthetic local pricing'}).isVisible());
    assert.match(await page.getByRole('note').textContent(),/NOT APPROVED AOC PRICING/);
    await page.getByRole('button',{name:'Finance and billing',exact:true}).click();
    await page.getByRole('button',{name:/^Describe the work/}).click();
    await page.locator('#description').fill('Synthetic local test: prepare monthly invoices in Wave. Our team reviews the approved information before sending.');
    await page.getByRole('button',{name:/Continue with editable fields/}).click();
    await page.locator('#f_solution').selectOption('workflow');
    if(!await page.locator('#f_steps_band').isVisible()) await page.getByText(/Process complexity/).click();
    await page.locator('#f_steps_band').selectOption('3'); await page.locator('#f_variation_band').selectOption('3');
    if(!await page.locator('#f_people_count').isVisible()) await page.getByText(/Team and rollout/).click();
    await page.locator('#f_people_count').fill('3'); await page.locator('#f_department_count').fill('2');
    await page.locator('#f_cadence').selectOption('monthly'); await page.locator('#f_handover').selectOption('group');
    await page.getByRole('button',{name:/Continue/}).click();
    await page.locator('#f_systems').fill(base.systems.join(', ')); await page.locator('#f_legacy_system_check').selectOption('Standard');
    await page.getByRole('button',{name:/Continue/}).click();
    await page.locator('#f_documentation_readiness').selectOption('Notes or examples'); await page.locator('#f_data_preparation_level').selectOption('Some preparation');
    await page.getByRole('button',{name:/Continue/}).click();
    await page.getByText('Calculate potential value',{exact:true}).click();
    await page.locator('#f_team_time').fill('40'); await page.locator('#f_blended_hourly_cost').fill('50');
    await page.locator('#f_provider_replaced_portion').selectOption('none'); await page.locator('#f_software_replaced_portion').selectOption('none'); await page.locator('#f_incremental_software_cost').fill('0');
    await page.getByRole('button',{name:/Continue/}).click();
    for (const [id,value] of Object.entries({delivery_intent:'limited',implementation_route:'project',existing_client:'no',responsibility_split:'aoc',action_mode:'approved',consequential:'yes'})) await page.locator(`#f_${id}`).selectOption(value);
    await page.locator('#quote-details > summary').click();
    for (const [id,value] of Object.entries({audit_fee:'1250',preparation_fee:'0',implementation_fee:'11500'})) await page.locator(`#f_${id}`).fill(value);
    await page.locator('#f_live_training').selectOption('no');
    await page.getByText('Check an existing audit credit',{exact:true}).click();
    for(const [id,value] of Object.entries({audit_paid:'1250',audit_sent_date:'2020-01-01',implementation_acceptance_date:'2020-01-10',first_implementation_payment_date:'2020-01-15'})) await page.locator(`#f_${id}`).fill(value);
    await page.locator('#f_audit_accepted_route').selectOption('project'); await page.locator('#f_audit_credit_used').selectOption('no');
    for(const [tier,fee] of Object.entries(fixture.supportPrices)) {
      await page.getByRole('button',{name:new RegExp(`^${tier}`,'i')}).click();
      const result=await calculate(); assert.equal(result.monthly,fee); assert.equal(result.net,1600-fee); assert.ok(result.commercialReady);
      assert.match(result.commercialNotice,/SYNTHETIC LOCAL TEST DATA/);
    }
    await page.locator('#f_delivery_intent').selectOption('ongoing'); await page.locator('#f_implementation_route').selectOption('monthly'); await page.locator('#f_audit_accepted_route').selectOption('monthly');
    await page.getByText('Agreed monthly proposal details (if provided by AOC)',{exact:true}).click();
    assert.equal(await page.locator('#f_agreed_monthly_hours').inputValue(),'','allowances are not automatically agreed');
    for(const [plan,proposal] of Object.entries(fixture.monthlyProposals)) {
      await page.locator('#f_monthly_plan').selectOption(plan);
      await page.locator('#f_agreed_monthly_hours').fill(String(proposal.hours)); await page.locator('#f_agreed_agency_blend').fill(String(proposal.blend));
      const result=await calculate(); assert.ok(result.commercialReady); assert.equal(result.monthly,proposal.hours*proposal.blend); assert.equal(result.build,null);
    }
    await page.locator('#f_agreed_monthly_hours').fill('');
    const cleared=await calculate(); assert.equal(cleared.agreedMonthlyHours,null); assert.equal(cleared.commercialReady,false);
    await page.setViewportSize({width:390,height:844});
    await page.getByText('Sample allowances to enter for a monthly program',{exact:true}).click();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'local warning and form fit on mobile');
    assert.deepEqual(errors,[]); assert.deepEqual(providerRequests,[]);
    console.log('PASS: local browser project support at all tiers, all three explicit monthly allowances, clearing, synthetic notice, mobile overflow and no paid AI.');
  } finally { if(browser) await browser.close(); await new Promise(resolve=>server.close(resolve)); }
})().catch(error=>{console.error(error);process.exitCode=1;});
