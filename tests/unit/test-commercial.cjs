const assert = require('node:assert/strict');
const Engine = require('../../public/journey-engine.js');
const Commercial = require('../../public/commercial.js');
const Rules = require('../../public/approved-pricing.js').commercial;
const Calculation = require('../../public/journey-calculation.js');
const Contract = require('../../public/journey-contract.js');
const base = require('../fixtures/commercial.cjs');
const calc = changes => Engine.calculate({ ...base, ...changes });
const historicalPricing=structuredClone(require('../../public/approved-pricing.js'));
historicalPricing.commercial=require('../../data/commercial-rules-20261021.json');
historicalPricing.core.handover={...require('../../public/engine.js').defaults.handover};
// Earlier monthly-program calculations are retained as historical regression coverage only.
const historicalCalc=changes=>Engine.calculate({...base,...changes},historicalPricing);
const request = changes => { const { area, process_confirmed, management, ...answers } = { ...base, ...changes }; return { area, confirmed: process_confirmed, answers }; };
const fixed = calc({});
assert.equal(fixed.build, 11500);
assert.equal(fixed.audit, 1250, 'audit is the supplied fixed quote, not 10%');
assert.equal(fixed.credit.amount, 1250);
assert.equal(fixed.projectBalance, 10250);
assert.equal(fixed.firstProjectPayment, 5125);
assert.equal(fixed.secondProjectPayment, 5125);
assert.equal(fixed.initialSpend, 11500);
assert.equal(fixed.yearInvestment, 11500);
assert.equal(fixed.net, 1600);
assert.equal(fixed.payback, 7.1875);
assert.equal(fixed.commercialReady, true);
assert.equal(Calculation.calculate(request({})).result.audit, 1250);
assert.equal(calc({ audit_fee: null }).audit, null);
assert.equal(calc({ audit_fee: null }).payback, null);
assert.equal(calc({ implementation_fee: null }).buildQuoted, false);
assert.equal(calc({ implementation_fee: null }).projectBalance, null);
assert.equal(calc({ implementation_fee: null }).payback, null);
assert.equal(calc({ preparation_fee: null }).projectBalance, null);
assert.equal(calc({ live_training: null }).projectBalance, null);
assert.equal(calc({ live_training: 'yes', live_training_fee: null }).projectBalance, null);
assert.equal(calc({ live_training: 'no', live_training_fee: 9999 }).build, 11500, 'inactive live-training fee is ignored');
assert.equal(calc({ live_training: 'yes', live_training_fee: 300 }).build, 11800);
assert.equal(calc({ audit_credit_used: 'yes' }).credit.amount, 0);
assert.equal(calc({ audit_credit_used: 'yes' }).initialSpend, 12750);
assert.equal(calc({ audit_credit_used: 'yes' }).payback, 12750 / 1600);
assert.equal(calc({ audit_credit_used: null }).credit.amount, null);
assert.equal(calc({ audit_credit_used: null }).payback, null);
assert.equal(calc({ audit_paid: 500 }).credit.amount, null, 'no partial audit credit');
assert.equal(calc({ audit_paid: 1400 }).credit.status, 'review');
const boundary = { ...base, audit_sent_date: '2026-10-01', implementation_acceptance_date: '2026-10-31', first_implementation_payment_date: '2026-10-31' };
assert.equal(Commercial.auditCredit(boundary, Rules, new Date('2026-10-31')).amount, 1250, 'day 30 inclusive');
assert.equal(Commercial.auditCredit({ ...boundary, first_implementation_payment_date: '2026-11-01' }, Rules, new Date('2026-11-01')).amount, 0);
assert.equal(Commercial.auditCredit({ ...boundary, implementation_acceptance_date: '2026-11-01' }, Rules, new Date('2026-11-01')).amount, 0);
assert.equal(Commercial.auditCredit({ ...boundary, first_implementation_payment_date: null }, Rules, new Date('2026-11-01')).amount, 0);
assert.equal(Commercial.auditCredit({ ...boundary, implementation_acceptance_date: '2026-09-30' }, Rules, new Date('2026-10-31')).amount, null);
assert.equal(Commercial.auditCredit(boundary, Rules, new Date('2026-10-20')).amount, null, 'planned dates are not actual acceptance/payment');
assert.equal(Commercial.date('2026-02-30'), null);
assert.ok(Commercial.date('2024-02-29'));
for (const tier of ['standard', 'priority', 'premier']) {
  assert.equal(calc({ management: 'yes', tier, quoted_support_fee: null }).monthly, null, 'tier has no invented fee');
  assert.equal(calc({ management: 'yes', tier, quoted_support_fee: 625 }).monthly, null,'client-supplied support fee cannot set the price');
}
const approvedSupportTestPricing = structuredClone(require('../../public/approved-pricing.js'));
approvedSupportTestPricing.commercial.supportPrices.priority = 625; // Synthetic trusted-source fixture only.
assert.equal(Engine.calculate({...base,management:'yes',tier:'priority'},approvedSupportTestPricing).monthly,625);
assert.equal(Engine.calculate({...base,team_time:1,management:'yes',tier:'priority'},approvedSupportTestPricing).net,-585);
assert.equal(Engine.calculate({...base,team_time:1,management:'yes',tier:'priority'},approvedSupportTestPricing).payback,null);
assert.equal(calc({ management: null, quoted_support_fee: 625 }).monthly, null);
assert.equal(calc({ management: 'no', quoted_support_fee: 625 }).monthly, 0);
const cents = calc({ implementation_fee: 5001, audit_fee: 250.11, audit_paid: 250.11 });
assert.equal(Math.round((cents.firstProjectPayment + cents.secondProjectPayment) * 100), Math.round(cents.projectBalance * 100));
assert.equal(calc({ implementation_fee: 500, audit_fee: 1250 }).projectBalance, null, 'over-credit is reviewed, not a negative invoice');
for (const [monthly_plan, expected] of Object.entries(Rules.monthlyPlans)) {
  const monthly = historicalCalc({ implementation_route: 'monthly', audit_accepted_route:'monthly', monthly_plan, comparison_months: 12, quoted_support_fee: 99999, live_training_fee: 99999 });
  assert.equal(monthly.monthly, expected);
  assert.equal(monthly.build, null, 'included builds are not a second upfront charge');
  assert.deepEqual(monthly.lines,[],'no standalone project-price breakdown in a monthly-program export');
  assert.equal(monthly.known,null);
  assert.equal(monthly.projectBalance, null);
  assert.equal(monthly.firstProjectPayment, null, 'no 50/50 monthly schedule');
  assert.equal(monthly.monthlyInvoiceAfterCredit, expected - 1250);
  assert.equal(monthly.yearInvestment, expected * 12);
  assert.equal(monthly.net, 1600 - expected);
  assert.equal(monthly.payback, null, 'no invented subscription startup/payback');
  assert.equal(monthly.agreedMonthlyHours, null);
  assert.equal(monthly.agreedAgencyBlend, null);
  assert.equal(monthly.commercialReady, false);
}
assert.equal(historicalCalc({ implementation_route: 'monthly', monthly_plan: null }).monthly, null);
const monthlyAgent=historicalCalc({implementation_route:'monthly',audit_accepted_route:'monthly',monthly_plan:'level1',solution:'agent',decision_band:3});
assert.equal(monthlyAgent.monthly,4000,'agreed program includes agent implementation scope without a flat agent upkeep surcharge');
assert.deepEqual(monthlyAgent.lines,[]);
assert.ok(calc({area:'area10',capability_count:1,brand_count:1,language_count:1,delivery_mode:'managed',monthly_outputs:null}).pending.some(message=>/Recurring production volumes/.test(message)));
assert.equal(calc({ implementation_route: null }).monthly, null);
assert.equal(historicalCalc({ implementation_route: 'monthly', monthly_plan: 'level1', comparison_months: null }).comparisonInvestment, null);
assert.equal(historicalCalc({ implementation_route: 'monthly', audit_accepted_route:'monthly', monthly_plan: 'level1', comparison_months: 6 }).comparisonInvestment, 24000);
assert.equal(historicalCalc({ implementation_route: 'monthly', monthly_plan: 'level1', comparison_months: 6, audit_credit_used: 'yes' }).comparisonInvestment, 25250);
const agreed = historicalCalc({ implementation_route: 'monthly', audit_accepted_route:'monthly', monthly_plan: 'level1', comparison_months: 12, agreed_monthly_hours: 16, agreed_agency_blend: 250 });
assert.equal(agreed.commercialReady, true, 'synthetic agreed proposal, no default hours or tariff');
assert.equal(historicalCalc({ implementation_route: 'monthly', audit_accepted_route:'monthly', monthly_plan: 'level1', audit_fee: 5000, audit_paid: 5000 }).monthlyInvoiceAfterCredit, null);
const existing = { existing_client: 'yes', existing_plan_name: 'Synthetic existing agreement', existing_plan_fee: 3500, retained_existing_fee: 2000, existing_retained_scope: 'Hosting and retained work', existing_replaced_scope: 'Some reporting', existing_plan_reconciled: 'yes', management: 'yes', quoted_support_fee: 625 };
assert.equal(calc({...existing,management:'no'}).combinedMonthlyCommitment, 2000);
assert.equal(calc(existing).cash, 0, 'agreement reduction is not automatically counted again as provider savings');
assert.equal(calc({ ...existing, existing_plan_reconciled: null }).combinedMonthlyCommitment, null);
assert.equal(calc({ ...existing, existing_plan_reconciled: null }).net, null);
assert.equal(calc({ ...existing, retained_existing_fee: null }).net, null);
assert.equal(calc({ ...existing, retained_existing_fee: 4000 }).combinedMonthlyCommitment, null);
assert.equal(calc({ ...existing, retained_existing_fee: 4000 }).net, null);
assert.equal(historicalCalc({ implementation_route: 'monthly', monthly_plan: 'level1', comparison_months: 12 }).comparisonGross, null, 'unknown benefit timing is not immediate savings');
assert.equal(historicalCalc({ implementation_route: 'monthly', monthly_plan: 'level1', comparison_months: 12, benefit_months: 0 }).comparisonGross, 0);
assert.equal(historicalCalc({ implementation_route: 'monthly', monthly_plan: 'level1', comparison_months: 12, benefit_months: 6 }).comparisonGross, 9600);
assert.equal(historicalCalc({ implementation_route: 'monthly', audit_accepted_route:'monthly', monthly_plan: 'level1', comparison_months: 12, benefit_months: 6 }).comparisonNet, -38400);
assert.equal(historicalCalc({ implementation_route:'monthly',monthly_plan:'level1',comparison_months:12 }).credit.status,'review','a project receipt cannot automatically authorize a monthly-route credit');
assert.equal(historicalCalc({ implementation_route:'monthly',monthly_plan:'level1',comparison_months:12 }).comparisonInvestment,null);
assert.equal(calc({audit_accepted_route:null}).credit.status,'pending');
assert.equal(historicalCalc({ implementation_route: 'monthly', monthly_plan: 'level1', comparison_months: 12, benefit_months: 13 }).comparisonInvestment, null);
for (const area of Array.from({ length: 12 }, (_, index) => `area${index}`)) {
  const result = calc({ area, capability_count: 1, channel_count: 2, format_count: 2, brand_count: 1, language_count: 1, market_count: 1, initial_pages: 0, keyword_count: 0, delivery_mode: 'maintenance', replacement_provider_cost: 2500, provider_replaced_portion: 'part', provider_removed_amount: 700 });
  assert.equal(result.provider, ['area6','area7','area8','area9','area10'].includes(area) ? 700 : 0, 'provider replacement only in workbook-eligible areas: '+area);
  assert.equal(result.cash, ['area6','area7','area8','area9','area10'].includes(area) ? 700 : 0);
}
assert.equal(calc({ area:'area10',provider_replaced_portion: null }).cash, null, 'missing provider information is not zero');
assert.equal(calc({ area:'area10',replacement_provider_cost: 100, provider_replaced_portion: 'part', provider_removed_amount: 200 }).net, null);
assert.equal(calc({ team_time: null }).net, null);
assert.equal(calc({ incremental_software_cost: null }).payback, null);
assert.equal(calc({ people_count: null }).build, null);
assert.equal(calc({ people_count: null }).firstProjectPayment, null);
assert.equal(calc({ legacy_system_check: 'Restricted' }).payback, null);
assert.equal(calc({ team_time: 1, management: 'yes', quoted_support_fee: 625 }).payback, null);
for (const [key, value] of [['audit_fee', -1], ['audit_fee', false], ['audit_fee', 0], ['implementation_fee', -1], ['comparison_months', 1.5], ['comparison_months', 0], ['audit_sent_date', '2026-02-30'], ['tier', 'critical'], ['monthly_plan', 'invented']]) assert.throws(() => Calculation.calculate(request({ [key]: value })));
assert.equal(Commercial.recommendRoute('limited'), 'project');
assert.equal(Commercial.recommendRoute('ongoing'), 'project');
assert.equal(Commercial.recommendRoute('unsure'), null);
const analysis = { title:'Test', summary:'Synthetic', solution:'workflow', classification:{steps:null,variations:null,decisions:null}, routes:[], facts:[], relevantFields:[], uncertainties:[] };
for(const text of ['We want one fixed-price project.','We want a fixed-price project.','We have selected a fixed-price project.']){
 const result=Contract.validate(analysis,text,'area10');
 assert.deepEqual(result.facts.find(f=>f.id==='implementation_route'),{id:'implementation_route',value:'project',quote:text},'explicit choice survives provider omission');
}
for(const text of [
 'We do not want a fixed-price project.', 'We might want a fixed-price project.',
 'Would a fixed-price project suit us?', 'We want a fixed-price project or a monthly program.',
 'We want a fixed-price project. We have not decided which route to choose.',
 'We want a fixed-price project. The implementation route is undecided.',
 'We want a fixed-price project. We now want a monthly build program.',
 'We want a fixed-price project. We are not sure about implementation.',
 'We want a fixed-price project. Help me decide the implementation route.',
 'Our budget is $4000. We want a bounded improvement.',
])assert.ok(!Contract.validate(analysis,text,'area10').facts.some(f=>f.id==='implementation_route'),'uncertain/negated/conflicting choices stay blank');
assert.equal(Contract.validate({...analysis,uncertainties:['Confirm the implementation route.']},'We want a fixed-price project.','area10').facts.find(f=>f.id==='implementation_route')?.value,'project','an unsupported model question cannot erase an explicit client choice');
const adSpendText='Our monthly ad spend is $3000.';
for(const id of ['replacement_provider_cost','provider_removed_amount','provider_replaced_portion']) {
 const result=Contract.validate({...analysis,facts:[{id,value:id==='provider_replaced_portion'?'all':'3000',quote:adSpendText}]},adSpendText,'area10');
 assert.ok(!result.facts.some(f=>f.id===id),'ad spend is not an external provider fee or its removal: '+id);
}
assert.equal(Contract.validate({...analysis,facts:[{id:'ads_012',value:'3000',quote:adSpendText}]},adSpendText,'area10').facts.find(f=>f.id==='ads_012')?.value,'3000','the stated advertising budget remains available in its own field');
const agencyFeeText='We pay our agency $900 per month for reporting.';
assert.equal(Contract.validate({...analysis,facts:[{id:'replacement_provider_cost',value:'900',quote:agencyFeeText}]},agencyFeeText,'area10').facts.find(f=>f.id==='replacement_provider_cost')?.value,'900','an actual quoted provider fee is retained');
for(const area of require('../../public/approved-bank.js').areas) {
 for(const field of area.fields.filter(field=>/responsibilit/i.test(field.question)&&/help decide/i.test(field.options))) {
  const unknown='We have not decided who will manage the finished workflow.';
  const known='Please help us decide who should manage the work.';
  assert.ok(!Contract.validate({...analysis,facts:[{id:field.id,value:'Help decide',quote:unknown}]},unknown,area.id).facts.some(f=>f.id===field.id),'unknown detailed responsibility stays unanswered: '+field.id);
  assert.equal(Contract.validate({...analysis,facts:[{id:field.id,value:'Help decide',quote:known}]},known,area.id).facts.find(f=>f.id===field.id)?.value,'Help decide','an explicit request for management help stays supported: '+field.id);
 }
}
const helpText='We want a fixed-price project. Help me decide the implementation route.';
assert.equal(Contract.validate({...analysis,facts:[{id:'implementation_route',value:'help',quote:'Help me decide the implementation route.'}]},helpText,'area10').facts.find(f=>f.id==='implementation_route').value,'help','an existing explicit choice is preserved');
const description = 'Our budget is $4000. Our internal hourly cost is $50. We want a monthly build program. AOC quoted an audit fee of $1250.';
const prefill = Contract.validate({ ...analysis, facts:[
  {id:'monthly_plan',value:'level1',quote:'Our budget is $4000.'},
  {id:'agreed_agency_blend',value:'50',quote:'Our internal hourly cost is $50.'},
  {id:'implementation_route',value:'monthly',quote:'We want a monthly build program.'},
  {id:'audit_fee',value:'1250',quote:'AOC quoted an audit fee of $1250.'},
] }, description, 'area0');
assert.ok(!prefill.facts.some(f=>f.id==='agreed_agency_blend'));
assert.ok(!prefill.facts.some(f=>f.id==='monthly_plan'),'a budget cannot select a program');
assert.equal(prefill.facts.find(f=>f.id==='audit_fee').value,'1250');
const selectedProgramText="We have chosen AOC's Level 1 monthly build program.";
const selectedProgramAnalysis=Contract.validate({...analysis,facts:[{id:'monthly_plan',value:'level1',quote:selectedProgramText}]},selectedProgramText,'area2');
assert.ok(!selectedProgramAnalysis.facts.some(f=>['monthly_plan','implementation_route'].includes(f.id)),'deferred programs do not become an active route');
for(const quote of ["We have not chosen AOC's Level 1 monthly program.","We haven’t selected AOC's Level 1 monthly program."]) assert.deepEqual(Contract.validate({...analysis,facts:[{id:'monthly_plan',value:'level1',quote}]},quote,'area0').facts,[],'negated plan choices do not become an automatic monthly route');
const quoteContext='AOC quoted a fixed audit fee of $900 and project implementation of $6,000.';
const contextualQuote=Contract.validate({...analysis,facts:[{id:'implementation_fee',value:'6000',quote:'project implementation of $6,000'}]},quoteContext,'area0');
assert.equal(contextualQuote.facts[0].quote,quoteContext,'a short excerpt can use its original contiguous AOC quote sentence as evidence');
const zeroQuoteText = 'AOC quoted an implementation fee of $0.';
const zeroPrefill = Contract.validate({...analysis,facts:[{id:'implementation_fee',value:'0',quote:zeroQuoteText}]},zeroQuoteText,'area0');
assert.equal(zeroPrefill.facts[0]?.value,'0','an explicit AOC zero quote survives prefill validation');
assert.equal(Contract.validate({...analysis,facts:[{id:'implementation_fee',value:'unknown',quote:zeroQuoteText}]},zeroQuoteText,'area0').facts.length,0,'unknown quotes are not turned into zero');
assert.ok(!Object.keys(fixed).some(key=>/founder|team_rate|internal_rate/.test(key)));
assert.equal(Rules.postBuildMaintenance, 'deferred');
assert.throws(()=>Calculation.calculate(request({quoted_support_fee:625})),'clients cannot supply a monthly service fee');
assert.throws(()=>Calculation.calculate(request({monthly_fee:1})),'clients cannot override an approved program fee');
assert.throws(()=>Calculation.calculate(request({audit_fee:[1250]})));
assert.throws(()=>Calculation.calculate(request({audit_fee:1e308})));
assert.equal(Calculation.calculate(request({preparation_fee:'  '})).result.projectBalance,null,'blank quote details are unknown, never zero');
assert.ok(!JSON.stringify(Rules).includes('2000'), 'no active deferred maintenance price');
console.log('PASS: current fixed-project rules, fixed audit/credit boundaries, historical monthly regressions, quoted support, agreement reconciliation, provider replacement, ROI, unknowns, clearing, and validation.');
