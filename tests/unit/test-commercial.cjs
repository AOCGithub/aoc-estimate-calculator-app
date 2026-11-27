const assert = require('node:assert/strict');
const Commercial = require('../../public/commercial.js');
const Pricing = require('../../public/approved-pricing.js');
const Contract = require('../../public/journey-contract.js');
const Calculation = require('../../public/journey-calculation.js');

assert.equal(Pricing.commercial.monthlyBuildStatus, 'deferred');
assert.equal(Commercial.date('2026-02-30'), null);
assert.ok(Commercial.date('2024-02-29'));

for (const area of Pricing.simplified.activeAreaIds) {
  const activeFields = new Set(Contract.fields(area).map(field => field.id));
  for (const retired of [
    'implementation_route', 'monthly_plan', 'delivery_intent', 'existing_client',
    'audit_credit_used', 'purchased_training', 'live_training', 'tier',
    'preparation_fee', 'implementation_fee', 'quoted_support_fee',
  ]) assert.ok(!activeFields.has(retired), `${retired} is not part of the current form`);
}

for (const retired of [
  'implementation_route', 'monthly_plan', 'tier', 'quoted_support_fee',
  'responsibility_split', 'management', 'handover', 'delivery_mode', 'legacy_system_check',
]) {
  assert.throws(() => Calculation.calculate({
    area: 'area0',
    confirmed: true,
    answers: { [retired]: 'legacy-value' },
  }), /Unknown calculation field/);
}

const prompt = Contract.prompt('area0');
assert.ok(!prompt.includes('monthly build subscriptions'));
assert.ok(prompt.includes('do not ask for support tiers'));
assert.ok(prompt.includes('Do not infer'));

console.log('PASS: retired route, monthly-program, support-tier, and quote inputs are excluded from the active contract.');
