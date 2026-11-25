const assert = require('node:assert/strict');
const Bank = require('../../public/approved-bank.js');
const Pricing = require('../../public/approved-pricing.js');
const Contract = require('../../public/journey-contract.js');
const Calculation = require('../../public/journey-calculation.js');

const active = new Set(Pricing.simplified.activeAreaIds);
assert.deepEqual(Pricing.simplified.comingSoonAreas.map(area => area.id), [
  'area6', 'area7', 'area8', 'area9', 'area10',
]);

for (const area of Pricing.simplified.comingSoonAreas) {
  assert.ok(Bank.areas.some(candidate => candidate.id === area.id), `${area.id} remains in the historical bank`);
  assert.ok(!active.has(area.id), `${area.id} is not active in the simplified calculator`);
  assert.throws(() => Contract.fields(area.id), /currently available/i);
  assert.throws(() => Contract.schema(area.id), /currently available/i);
  assert.throws(
    () => Calculation.calculate({ area: area.id, confirmed: true, answers: {} }),
    /currently available/i,
  );
}

for (const area of active) {
  const fields = Contract.fields(area);
  assert.ok(fields.some(field => field.id === 'team_time'));
  assert.ok(fields.some(field => field.id === 'blended_hourly_cost'));
  assert.ok(fields.some(field => field.id === 'systems'));
}

console.log('PASS: the five marketing categories remain Coming Soon and are rejected by analysis and calculation APIs.');
