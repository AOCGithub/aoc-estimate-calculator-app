const assert = require('node:assert/strict');
const Contract = require('../../public/journey-contract.js');
const Calculation = require('../../public/journey-calculation.js');
const fixture = require('../fixtures/commercial.cjs');
const empty = { title: 'Paid advertising', summary: 'Synthetic regression input', solution: 'workflow',
  recommendationReason: 'Defined sequence', classification: { steps: null, variations: null, decisions: null, reason: 'Review' },
  routes: [], facts: [], relevantFields: [], uncertainties: [] };
const recover = (text, area = 'area10', facts = []) => Contract.validate({ ...empty, facts }, text, area).facts;
const values = facts => Object.fromEntries(facts.map(fact => [fact.id, fact.value]));
const text = 'We want an AI-assisted workflow covering six capabilities: performance reporting, budget monitoring, creative drafts, campaign recommendations, product-feed checks, and approval coordination. '
  + 'We need 24 advertising outputs per month: eight original concepts and 16 adaptations. '
  + 'Our team supplies approved photos and guidelines. AOC prepares the agreed creative and copy.';
const recovered = recover(text);
assert.deepEqual(values(recovered), { capability_count: '6', monthly_outputs: '24', delivery_mode: 'managed' });
for (const fact of recovered) assert.ok(text.includes(fact.quote), 'Recovered facts retain contiguous source evidence');
assert.deepEqual(recover(text, 'area0'), [], 'Marketing recovery cannot add unrelated fields to other areas');
assert.equal(values(recover('We need 6 connected capabilities.')).capability_count, '6');
assert.equal(values(recover('We need 1,000 connected capabilities.')).capability_count, '1000');
for (const uncertain of [
  'We do not want six capabilities.', 'We might need six capabilities.', 'We need about six capabilities.',
  'We need six to eight capabilities.', 'We need 6-8 capabilities.', 'We need 6.5 capabilities.',
  'We need twenty six capabilities.', 'We need six capabilities. We need eight capabilities.',
  'We need six capabilities. We might need eight capabilities.', 'We need several capabilities.', 'We need 12,34 capabilities.',
]) assert.equal(values(recover(uncertain)).capability_count, undefined, uncertain);
assert.equal(values(recover('We need 24 outputs monthly.')).monthly_outputs, '24');
assert.equal(values(recover('We need about 24 outputs monthly.')).monthly_outputs, undefined);
assert.equal(values(recover('We need 24 outputs monthly.')).delivery_mode, undefined, 'Volume alone does not choose a service');
for (const scope of [
  'We want ongoing development and daily monitoring.',
  'Our team prepares 24 outputs monthly. AOC builds the automation.',
  'We need 24 outputs monthly. AOC prepares initial creative.',
  'We need 24 outputs monthly. AOC should not prepare the creative.',
  'We need 24 outputs monthly. AOC prepares creative. No ongoing production is included.',
  'We need 24 outputs monthly. AOC prepares creative. We are unsure whether AOC manages production.',
]) assert.equal(values(recover(scope)).delivery_mode, undefined, scope);
assert.equal(values(recover('AOC manages ongoing production.')).delivery_mode, 'managed');
assert.equal(values(recover('AOC manages ongoing production.')).monthly_outputs, undefined, 'No output entitlement is invented');
assert.equal(recover(text, 'area10', recovered).filter(fact => fact.id === 'capability_count').length, 1);

// The missing fields caused the supplied quote to be withheld. Restore explicit
// scope facts, while unquoted support prices and unpaid credit remain pending.
const { area, process_confirmed, management, ...answers } = fixture;
Object.assign(answers, { capability_count: 6, brand_count: 1, language_count: 1, delivery_mode: 'managed', monthly_outputs: 24,
  responsibility_split: 'shared', tier: 'standard', audit_paid: 0, audit_sent_date: null,
  implementation_acceptance_date: null, first_implementation_payment_date: null, incremental_software_cost: 80 });
const result = Calculation.calculate({ area: 'area10', answers, confirmed: true }).result;
assert.equal(result.build, 11500); assert.equal(result.audit, 1725); assert.equal(result.auditRate, 0.15);
assert.equal(result.monthly, null); assert.equal(result.net, null); assert.equal(result.credit.amount, null);
assert.equal(result.errors.length, 0);
console.log('PASS: Explicit paid-advertising counts and production survive AI omissions; unknown, negated, ranged and conflicting scope stays blank; quoted build is restored without inventing support prices or credit.');
