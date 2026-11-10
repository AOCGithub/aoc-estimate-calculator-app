// Regression expectations transcribed from the reviewed 28–29 October sources.
const assert = require('node:assert/strict');
const Engine = require('../../public/journey-engine.js');
const Calculation = require('../../public/journey-calculation.js');
const Contract = require('../../public/journey-contract.js');
const Bank = require('../../public/approved-bank.js');
const Price = require('../../public/approved-pricing.js');
const base = require('../fixtures/commercial.cjs');
const calc = changes => Engine.calculate({ ...base, ...changes });
const request = changes => {
  const { area, process_confirmed, management, ...answers } = { ...base, ...changes };
  return { area, confirmed: process_confirmed, answers };
};

// Fixed-price launch; preserved planning fees cannot be purchased or extracted by AI.
assert.equal(Price.commercial.monthlyBuildStatus, 'deferred');
assert.throws(() => Calculation.calculate(request({ implementation_route: 'monthly' })), /Invalid choice/);
assert.equal(calc({ implementation_route: 'monthly', monthly_plan: 'level1' }).monthly, null);
assert.equal(calc({ implementation_route: 'monthly', monthly_plan: 'level1' }).build, null);
for (const area of Bank.areas) {
  for (const id of ['monthly_plan', 'agreed_monthly_hours', 'agreed_agency_blend', 'comparison_months', 'benefit_months']) {
    assert.ok(!Contract.fields(area.id).some(field => field.id === id));
  }
}

// Workflow Automation!B20,B24:B25: included reusable training is zero.
for (const handover of ['one', 'group', 'multiple']) {
  const draft = calc({ implementation_fee: null, handover });
  assert.equal(draft.build, 11000);
  assert.equal(draft.lines.find(line => /Training & handover/.test(line.label)).amount, 0);
  assert.equal(calc({ handover }).build, 11500, 'an entered accepted quote is preserved');
  assert.equal(calc({ handover, live_training: 'yes', live_training_fee: 300 }).build, 11800);
}

// Web Calculator Test!B63: provider replacement is limited to marketing areas 6–10.
for (let index = 0; index < 12; index++) {
  const eligible = index >= 6 && index <= 10;
  const changes = { area: `area${index}`, capability_count: 1, channel_count: 2, format_count: 2,
    brand_count: 1, language_count: 1, market_count: 1, initial_pages: 0, keyword_count: 0,
    delivery_mode: 'maintenance', replacement_provider_cost: 900, provider_replaced_portion: 'all' };
  const result = calc(changes);
  assert.equal(result.provider, eligible ? 900 : 0);
  assert.equal(result.net, eligible ? 2500 : 1600);
  assert.equal(result.payback, 11500 / (eligible ? 2500 : 1600));
  assert.equal(calc({ ...changes, replacement_provider_cost: null, provider_replaced_portion: 'part', provider_removed_amount: 100 }).net, eligible ? null : 1600);
}

// B63:B64 require the current total and eliminated portion; blank is never zero.
for (const kind of ['software', 'provider']) {
  const fields = kind === 'software'
    ? { total: 'software_replaced_cost', mode: 'software_replaced_portion', part: 'software_removed_amount' }
    : { total: 'replacement_provider_cost', mode: 'provider_replaced_portion', part: 'provider_removed_amount' };
  const marketing = { area: 'area10', capability_count: 1, brand_count: 1, language_count: 1, delivery_mode: 'maintenance' };
  const partial = { ...marketing, [fields.total]: 500, [fields.mode]: 'part', [fields.part]: 100 };
  assert.equal(calc(partial)[kind], 100);
  for (const changes of [{ [fields.total]: null }, { [fields.part]: null }, { [fields.mode]: 'unknown' }]) {
    const result = calc({ ...partial, ...changes });
    assert.equal(result[kind], null);
    assert.equal(result.net, null);
    assert.equal(result.payback, null);
    assert.equal(result.yearNet, null);
  }
  assert.equal(calc({ ...partial, [fields.part]: 501 }).net, null);
  assert.equal(calc({ ...partial, [fields.mode]: 'none', [fields.total]: null })[kind], 0);
  assert.equal(calc({ ...partial, [fields.total]: 0, [fields.part]: 0 })[kind], 0);
}

// Audit & Project Quote!B22:B23: ROUND(first half,2), then remaining cents.
for (let balanceCents = 1; balanceCents <= 10000; balanceCents++) {
  const result = calc({ implementation_fee: (125000 + balanceCents) / 100 });
  const first = Math.ceil(balanceCents / 2);
  assert.equal(result.firstProjectPayment, first / 100);
  assert.equal(result.secondProjectPayment, (balanceCents - first) / 100);
}
const split = calc({ implementation_fee: 11250.05 });
assert.equal(split.firstProjectPayment, 5000.03);
assert.equal(split.secondProjectPayment, 5000.02);

// Independent integer-cent expectations for quote, credit, ROI and payback combinations.
const cents = value => { const [whole, fraction = ''] = String(value).split('.'); return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0').slice(0, 2)); };
const dollars = value => Number(value) / 100;
let ordinaryCases = 0;
for (const prep of [0, 100, 999.99]) for (const implementation of [5000, 11500, 12345.67])
for (const training of [0, 250]) for (const audit of [500, 1250]) for (const used of [false, true]) for (const vendor of [0, 29.99]) {
  const result = calc({ preparation_fee: prep, implementation_fee: implementation, live_training: training ? 'yes' : 'no',
    live_training_fee: training, audit_fee: audit, audit_paid: audit, audit_credit_used: used ? 'yes' : 'no', incremental_software_cost: vendor });
  const total = cents(prep) + cents(implementation) + cents(training), credit = used ? 0n : cents(audit);
  const balance = total - credit, first = (balance + 1n) / 2n, initial = total + cents(audit) - credit;
  const monthlyBenefit = 160000n - cents(vendor), investment = initial + 12n * cents(vendor);
  const expected = { build: dollars(total), projectBalance: dollars(balance), firstProjectPayment: dollars(first),
    secondProjectPayment: dollars(balance - first), initialSpend: dollars(initial), freed: 32, retained: 8, capacity: 1600,
    net: dollars(monthlyBenefit), yearInvestment: dollars(investment), yearGross: 19200, yearNet: dollars(1920000n - investment) };
  for (const [key, value] of Object.entries(expected)) assert.equal(result[key], value, key);
  assert.ok(Math.abs(result.payback - dollars(initial) / dollars(monthlyBenefit)) < 1e-9);
  ordinaryCases++;
}
assert.equal(ordinaryCases, 144);

// Detailed approved fields only: overview/status rows are not questions.
assert.deepEqual(Bank.areas.map(area => area.fields.length), [16,24,46,124,84,80,119,111,121,114,107,36]);
assert.ok(!Bank.areas[4].fields.some(field => field.id === 'payroll'));
assert.ok(!Contract.schema('area4').properties.facts.items.properties.id.enum.includes('payroll'));
assert.throws(() => Calculation.calculate(request({ area: 'area4', payroll: 'Yes' })), /Unknown calculation field/);
for (const area of Bank.areas) assert.ok(area.fields.every(field => !/^(Locked|Excluded|Route listed)\s*[—-]/i.test(field.options)));
console.log('PASS: 28–29 October fixed-price launch, included training, 12-area ROI eligibility, unknown savings, 10,000 exact-cent splits, 144 independent quote/ROI cases, approved question/AI/API boundaries.');
