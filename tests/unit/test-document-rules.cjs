const assert = require('node:assert/strict');
const Pricing = require('../../public/approved-pricing.js');
const Engine = require('../../public/journey-engine.js');
const Contract = require('../../public/journey-contract.js');
const Calculation = require('../../public/journey-calculation.js');

const base = {
  area: 'area0',
  solution: 'workflow',
  steps_band: 2,
  variation_band: 2,
  systems: 'None',
  workspace_context: 'none',
  ai_account_context: 'none',
  documentation_readiness: 'Clear and current',
  data_information_location: 'Shared files',
  data_preparation_level: 'clean',
  data_preparation_owner: 'Our team',
  people_count: 2,
  department_count: 1,
  action_mode: 'draft',
  process_confirmed: true,
  team_time: 12,
  blended_hourly_cost: 30,
};
const baseline = Engine.calculate(base);
assert.equal(Pricing.simplified.prep.clean, 0);
assert.equal(Pricing.simplified.prep.existing, 1000);
assert.equal(Pricing.simplified.prep.partial, 1000);
assert.equal(Pricing.simplified.prep.limited, 2000);
assert.equal(Pricing.simplified.prep.unknown, 2000);
assert.equal(baseline.build, 5250);
assert.ok(!baseline.lines.some(line => /preparation/i.test(line.label)), 'clean readiness adds no preparation charge');

for (const level of ['existing', 'partial', 'limited', 'unknown']) {
  const result = Engine.calculate({ ...base, data_preparation_level: level });
  assert.equal(result.build, baseline.build + Pricing.simplified.prep[level], `${level} readiness uses its approved allowance`);
}

const contradictoryClean = Engine.calculate({
  ...base,
  documentation_readiness: 'Notes or examples',
});
assert.equal(contradictoryClean.build, baseline.build + Pricing.simplified.prep.existing);
assert.ok(contradictoryClean.warnings.some(warning => /both confirm complete, current/i.test(warning)));

const fields = new Set(Contract.fields('area0').map(field => field.id));
for (const required of [
  'systems', 'workspace_context', 'ai_account_context', 'documentation_readiness',
  'data_information_location', 'data_preparation_level', 'data_preparation_owner',
  'team_time', 'blended_hourly_cost',
]) assert.ok(fields.has(required), `${required} remains in the current intake`);
assert.ok(!fields.has('incremental_software_cost'), 'future operating costs are not an intake field');

const missingReadiness = Engine.calculate({ ...base, data_information_location: null });
assert.notEqual(missingReadiness.build, null, 'known build inputs can still produce a provisional estimate');
assert.equal(missingReadiness.commercialReady, false);
assert.ok(missingReadiness.pending.some(item => /where the process information is located/i.test(item)));

assert.throws(() => Calculation.calculate({
  area: 'area0',
  confirmed: true,
  answers: { data_preparation_level: 'Some preparation' },
}), /Invalid choice/);
assert.throws(() => Calculation.calculate({
  area: 'area0',
  confirmed: true,
  answers: { incremental_software_cost: 80 },
}), /Unknown calculation field/);

console.log('PASS: document/data readiness allowances, $0 eligibility, required intake context, and excluded future operating costs.');
