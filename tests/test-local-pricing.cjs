const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createTestPricing, createPreviewServer } = require('../scripts/local-test-pricing.cjs');
const fixture = require('./fixtures/local-test-pricing.json');
const base = require('./fixtures/commercial.cjs');
const normalCalculation = require('../public/journey-calculation.js');
const productionPricing = require('../public/approved-pricing.js');
const productionBank = require('../public/approved-bank.js');
const version = productionPricing.version;
const sourceFiles = ['data/commercial-rules-20261021.json', 'public/approved-pricing.js', 'public/approved-bank.js'];
const before = sourceFiles.map(file => fs.readFileSync(file, 'utf8'));
function payload(changes = {}) {
  const { area, process_confirmed, management, ...answers } = { ...base, ...changes };
  return { area, confirmed: process_confirmed, answers };
}
(async () => {
  const local = createTestPricing();
  for (const [tier, fee] of Object.entries(fixture.supportPrices)) {
    const body = payload({ responsibility_split:'aoc', tier });
    const result = local.calculate(body).result;
    assert.equal(result.monthly, fee);
    assert.equal(result.net, 1600 - fee);
    assert.equal(result.payback, 11500 / (1600 - fee));
    assert.ok(result.commercialReady);
    assert.match(result.commercialNotice, /SYNTHETIC LOCAL TEST DATA/);
    assert.equal(normalCalculation.calculate(body).result.monthly, null, 'normal calculation still has no invented support fee');
  }
  for (const [monthly_plan, proposal] of Object.entries(fixture.monthlyProposals)) {
    const body = payload({ implementation_route:'monthly', delivery_intent:'ongoing', audit_accepted_route:'monthly', monthly_plan, agreed_monthly_hours:proposal.hours, agreed_agency_blend:proposal.blend, comparison_months:12, benefit_months:6 });
    const result = local.calculate(body).result;
    assert.ok(result.commercialReady);
    assert.equal(result.monthly, productionPricing.commercial.monthlyPlans[monthly_plan]);
    assert.equal(result.agreedMonthlyHours, proposal.hours);
    assert.equal(result.agreedAgencyBlend, proposal.blend);
    assert.equal(result.build, null);
    assert.equal(result.comparisonInvestment, result.monthly * 12);
    assert.equal(result.comparisonGross, 9600);
    assert.equal(local.calculate({ ...body, answers:{ ...body.answers, agreed_monthly_hours:null } }).result.agreedMonthlyHours, null, 'unknown allowances are never filled automatically');
    assert.equal(local.calculate({ ...body, answers:{ ...body.answers, agreed_monthly_hours:null } }).result.commercialReady, false);
  }
  assert.equal(productionBank.version, version);
  assert.equal(productionPricing.version, version);
  for (const fee of Object.values(productionPricing.commercial.supportPrices)) assert.equal(fee,null);
  const server = createPreviewServer();
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    const html = await (await fetch(origin)).text();
    assert.match(html,/SYNTHETIC LOCAL TEST DATA/);
    assert.match(html,/Sample allowances to enter/);
    const js = await (await fetch(`${origin}/approved-pricing.js`)).text();
    assert.match(js,/synthetic-local/); assert.match(js,/"priority":625/);
    const response = await fetch(`${origin}/api/journey/calculate`,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(payload({responsibility_split:'aoc',tier:'priority'}))});
    const data = await response.json(); assert.equal(response.status,200); assert.equal(data.result.monthly,625); assert.equal(data.testOnly,true);
    assert.match(data.version,/synthetic-local/);
    assert.equal((await fetch(`${origin}/api/journey/calculate`,{method:'POST',headers:{origin:'https://untrusted.invalid','content-type':'application/json'},body:'{}'})).status,403);
    assert.equal((await fetch(`${origin}/api/journey/calculate`,{method:'POST',headers:{origin,'content-type':'application/json'},body:'{'})).status,400);
    const organizer = await fetch(`${origin}/api/journey/analyze`,{method:'POST',headers:{origin,'content-type':'application/json'},body:'{}'});
    assert.equal((await organizer.json()).localFallback,true,'no paid AI request can be made through this preview');
    for (let i=0;i<sourceFiles.length;i++) assert.equal(fs.readFileSync(sourceFiles[i],'utf8'),before[i],'production data remains unchanged');
  } finally { await new Promise(resolve=>server.close(resolve)); }
  console.log('PASS: all three synthetic support prices, three explicit program allowances, ROI, unknown allowances, isolated normal rules, local API and preview banner. No production pricing changes or AI calls.');
})().catch(error=>{console.error(error);process.exitCode=1;});
