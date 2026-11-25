const assert = require('node:assert/strict');
const Bank = require('../../public/approved-bank.js');
const Pricing = require('../../public/approved-pricing.js');
const Engine = require('../../public/journey-engine.js');
const Contract = require('../../public/journey-contract.js');
const Calculation = require('../../public/journey-calculation.js');

const base = {
  area: 'area0',
  solution: 'workflow',
  steps_band: 2,
  variation_band: 2,
  documentation_readiness: 'Clear and current',
  data_information_location: 'Apps already identified',
  data_preparation_level: 'clean',
  data_preparation_owner: 'Our team',
  systems: 'Wave',
  workspace_context: 'google_workspace',
  ai_account_context: 'chatgpt_business',
  people_count: 3,
  department_count: 2,
  action_mode: 'approved',
  consequential: 'yes',
  process_confirmed: true,
  cadence: 'monthly',
  team_time: 40,
  blended_hourly_cost: 50,
};
const line = (result, label) => result.lines.find(item => item.label === label);
const result = Engine.calculate(base);

assert.deepEqual(Pricing.simplified.activeAreaIds, ['area2', 'area0', 'area1', 'area3', 'area4', 'area5']);
assert.equal(Bank.areas.length, 12, 'historical banks remain available for references and tests');
assert.equal(result.build, 6250);
assert.equal(result.low, 5000);
assert.equal(result.high, 7800);
assert.equal(result.audit, 937.5);
assert.equal(result.auditRate, 0.15);
assert.equal(result.buildQuoted, false);
assert.equal(result.credit.status, 'conditional');
assert.equal(result.credit.amount, null);
assert.equal(result.credit.potentialAmount, result.audit);
assert.equal(result.monthly, 0, 'the retired monthly service price is not calculated');
assert.equal(result.monthlyParts.length, 0);
assert.equal(result.commercialReady, true);
assert.equal(line(result, 'Department ownership and handoffs').amount, 1000, 'the $500 department rate starts with the first department');
assert.equal(line(result, 'Human review workflow').amount, 500);
assert.equal(line(result, 'Launch Support (proposed; one-time)').amount, 500);
assert.equal(line(result, 'Launch Support (proposed; one-time)').status, 'Proposed — not finalized');
assert.equal(result.freed, 32);
assert.equal(result.retained, 8);
assert.equal(result.capacity, 1600);
assert.equal(result.cash, null, 'unconfirmed savings are not displayed as confirmed $0 savings');
assert.equal(result.baselineMonthlyBenefit, 1600);
assert.equal(result.payback, 6250 / 1600);
assert.equal(result.usage.monthlyItems, 100, 'unknown workload uses the disclosed planning assumption');
assert.equal(result.usage.scheduledChecks, 30);
assert.ok(result.makeBudget.low >= 20);
assert.ok(result.makeBudget.high > result.makeBudget.low);

for (const areaId of Pricing.simplified.activeAreaIds) {
  const categoryResult = Engine.calculate({ ...base, area: areaId });
  assert.equal(categoryResult.audit, categoryResult.build * 0.15, `${areaId} receives the shared 15% discovery fee`);
  assert.equal(categoryResult.auditPurchasable, true, `${areaId} can continue to the shared Stripe checkout`);
  assert.equal(categoryResult.paidServiceName, Pricing.simplified.paidServiceName);
}

const noApps = Engine.calculate({ ...base, systems: 'None' });
assert.equal(noApps.build, result.build - 500);
const unknownApps = Engine.calculate({ ...base, systems: 'Not sure' });
assert.equal(unknownApps.build, null);
assert.ok(unknownApps.pending.some(item => /apps that must connect/i.test(item)));
const multipleApps = Engine.calculate({ ...base, systems: ['Wave', 'Stripe'] });
assert.equal(multipleApps.build, result.build + 500);

const existingPrep = Engine.calculate({ ...base, data_preparation_level: 'existing' });
const limitedPrep = Engine.calculate({ ...base, data_preparation_level: 'limited' });
assert.equal(existingPrep.build, result.build + 1000);
assert.equal(limitedPrep.build, result.build + 2000);
const conflictingClean = Engine.calculate({
  ...base,
  documentation_readiness: 'Notes or examples',
});
assert.equal(conflictingClean.build, result.build + 1000, '$0 preparation requires both readiness answers');
assert.ok(conflictingClean.warnings.some(item => item.includes('$0 preparation amount was not used')));

const missingPeople = Engine.calculate({ ...base, people_count: null });
assert.equal(missingPeople.build, null);
assert.ok(missingPeople.pending.some(item => /positive whole number of people/i.test(item)));
const missingRoi = Engine.calculate({ ...base, team_time: null });
assert.notEqual(missingRoi.build, null);
assert.equal(missingRoi.auditPurchasable, false);
assert.ok(missingRoi.pending.some(item => /monthly team hours are required/i.test(item)));
assert.ok(Engine.calculate({ ...base, team_time: 0 }).errors.some(item => /greater than zero/i.test(item)));
assert.ok(Engine.calculate({ ...base, blended_hourly_cost: 0 }).errors.some(item => /greater than zero/i.test(item)));

const countedSavings = Engine.calculate({
  ...base,
  replacement_provider_cost: 200,
  provider_replaced_portion: 'part',
  provider_removed_amount: 120,
});
assert.equal(countedSavings.cash, 120);
assert.equal(countedSavings.baselineMonthlyBenefit, 1720);
assert.ok(Engine.calculate({
  ...base,
  replacement_provider_cost: 100,
  provider_replaced_portion: 'part',
  provider_removed_amount: 120,
}).errors.some(item => /cannot exceed current cost/i.test(item)));

const autoConsequential = Engine.calculate({ ...base, action_mode: 'automatic', consequential: 'yes' });
assert.equal(line(autoConsequential, 'Consequential automatic-action controls').amount, 1500);
assert.equal(line(autoConsequential, 'Human review workflow'), undefined, 'control allowance does not stack with the review fee');
const autoNonConsequential = Engine.calculate({ ...base, action_mode: 'automatic', consequential: 'no' });
assert.equal(line(autoNonConsequential, 'Consequential automatic-action controls'), undefined);
assert.equal(line(autoNonConsequential, 'Human review workflow'), undefined);
const autoUnknown = Engine.calculate({ ...base, action_mode: 'automatic', consequential: null });
assert.equal(line(autoUnknown, 'Human review workflow (assumed)').amount, 500);
assert.ok(autoUnknown.pending.some(item => /automatic actions affect/i.test(item)));

const assumedComplexity = Engine.calculate({ ...base, steps_band: null, variation_band: 4 });
assert.equal(assumedComplexity.level, 'complex', 'retain higher known complexity when another answer is missing');
assert.ok(assumedComplexity.assumptions.some(item => /higher known answers were retained/i.test(item)));
const hourly = Engine.calculate({ ...base, cadence: 'hourly' });
assert.equal(hourly.usage.scheduledChecks, Pricing.simplified.usage.hourlyChecks);
assert.ok(hourly.usage.highCredits > result.usage.highCredits);

const usageBase = {
  solution: 'workflow',
  steps_band: 2,
  variation_band: 2,
  documentation_readiness: 'Clear and current',
  data_information_location: 'Apps already identified',
  data_preparation_level: 'existing',
  data_preparation_owner: 'Our team',
  workspace_context: 'google_workspace',
  ai_account_context: 'chatgpt_business',
  people_count: 2,
  department_count: 1,
  action_mode: 'draft',
  process_confirmed: true,
  cadence: 'monthly',
  team_time: 40,
  blended_hourly_cost: 30,
};
const simplifiedRegressions = [
  ['area2', 'reply_volume', 500, 3, 5, 2, false, 7750, 1162.5, 21100, 57100, 35, 175],
  ['area0', 'invoice_volume', 80, 3, 2, 2, false, 7750, 1162.5, 2500, 6600, 20, 30],
  ['area1', 'order_volume', 600, 3, 5, 2, false, 7750, 1162.5, 25300, 68500, 40, 210],
  ['area3', 'inquiry_volume', 120, 3, 5, 2, false, 7750, 1162.5, 5100, 13800, 20, 45],
  ['area4', 'hr_013', 8, 2, 2, 2, false, 7250, 1087.5, 300, 700, 20, 30],
  ['area5', 'admin_013', 120, 5, 4, 1, true, 6750, 1012.5, 6000, 13100, 20, 40],
];
for (const [areaId, volumeId, volume, appCount, taskCount, band, documentHeavy,
  build, audit, lowCredits, highCredits, lowBudget, highBudget] of simplifiedRegressions) {
  const calculated = Engine.calculate({
    ...usageBase,
    area: areaId,
    steps_band: band,
    variation_band: band,
    systems: Array.from({ length: appCount }, (_, index) => `App ${index + 1}`),
    selected_task_count: taskCount,
    [volumeId]: volume,
    ...(documentHeavy ? { data_material_format: 'Some PDFs require extraction' } : {}),
  });
  assert.equal(calculated.build, build, `${areaId} build matches the simplified test sheet`);
  assert.equal(calculated.audit, audit, `${areaId} paid-discovery fee matches the simplified test sheet`);
  assert.deepEqual(
    [calculated.usage.lowCredits, calculated.usage.highCredits,
      calculated.makeBudget.low, calculated.makeBudget.high],
    [lowCredits, highCredits, lowBudget, highBudget],
    `${areaId} Make usage and budget match the simplified test sheet`,
  );
}

assert.throws(() => Contract.fields('area7'), /currently available/i);
assert.throws(() => Calculation.calculate({ area: 'area7', confirmed: true, answers: {} }), /currently available/i);
assert.throws(() => Calculation.calculate({
  area: 'area0',
  confirmed: true,
  answers: { workspace_context: 'INVALID' },
}), /Invalid choice/i);
assert.throws(() => Calculation.calculate({
  area: 'area0',
  confirmed: true,
  answers: { unknown_field: 'value' },
}), /Unknown calculation field/i);
assert.throws(() => Calculation.calculate({
  area: 'area0',
  confirmed: 'yes',
  answers: {},
}), /Confirm whether/i);
assert.throws(() => Calculation.calculate({
  area: 'area0',
  confirmed: true,
  routes: ['Not a real process step'],
  answers: {},
}), /selected process steps/i);
const ordersArea = Bank.areas.find(candidate => candidate.id === 'area1');
const legacyGroupedRoute = ordersArea.fields
  .map(field => field.route)
  .find(route => route && !ordersArea.routes.includes(route));
assert.doesNotThrow(() => Calculation.calculate({
  area: 'area1',
  confirmed: true,
  routes: [legacyGroupedRoute],
  answers: {},
}), 'a grouped question-bank route from the same area remains compatible');
assert.deepEqual(
  Contract.schema('area1').properties.routes.items.enum,
  [...new Set(ordersArea.routes)],
  'new organizer results use the same process-step list displayed by the UI',
);

const financeRoutes = Bank.areas.find(candidate => candidate.id === 'area0').routes.slice(0, 2);
const { area: usageArea, process_confirmed: usageConfirmed, selected_task_count: ignoredTaskCount,
  ...financeAnswers } = {
  ...usageBase,
  area: 'area0',
  systems: ['App 1', 'App 2', 'App 3'],
  invoice_volume: '80',
};
const routedCalculation = Calculation.calculate({
  area: usageArea,
  confirmed: usageConfirmed,
  routes: financeRoutes,
  answers: financeAnswers,
});
assert.equal(routedCalculation.result.usage.selectedTaskCount, 2);
assert.deepEqual(
  [routedCalculation.result.usage.lowCredits, routedCalculation.result.usage.highCredits],
  [2500, 6600],
  'the validated route count reaches the server calculation',
);

const text = 'We send invoices through Wave.';
const analysis = {
  title: 'Invoice sending',
  summary: 'Prepare and send invoices.',
  solution: 'workflow',
  recommendationReason: 'Repeatable steps',
  classification: { steps: 2, variations: null, decisions: null, reason: 'Several steps' },
  routes: [],
  facts: [{ id: 'systems', value: 'Wave', quote: text }],
  relevantFields: ['systems'],
  uncertainties: [],
};
assert.equal(Contract.validate(analysis, text, 'area0').facts[0].value, 'Wave');
const mereMention = 'Wave is mentioned, but no connection action was described.';
assert.deepEqual(Contract.validate({
  ...analysis,
  facts: [{ id: 'systems', value: 'Wave', quote: 'Wave is mentioned' }],
}, mereMention, 'area0').facts, [], 'an app name without a connection action is not prefilled');
assert.deepEqual(Contract.validate({
  ...analysis,
  facts: [{ id: 'systems', value: 'Stripe', quote: text }],
}, text, 'area0').facts, [], 'a suggested app must appear in its evidence quote');
assert.ok(Contract.prompt('area0').includes('Mentioning an app does not mean it must connect'));
assert.ok(!Contract.prompt('area0').includes('monthly build subscriptions'));

const { area, process_confirmed: confirmed, ...answers } = base;
const apiResult = Calculation.calculate({ area, confirmed, answers });
assert.equal(apiResult.result.build, result.build);
assert.equal(apiResult.result.audit, result.audit);
assert.equal(apiResult.version, Bank.version);

const agentApiResult = Calculation.calculate({
  area,
  confirmed,
  answers: { ...answers, solution: 'agent', decision_band: 3 },
});
assert.equal(agentApiResult.result.level, 'complex');
assert.equal(agentApiResult.result.errors.length, 0, 'the agent decision band is accepted by the server contract');

console.log('PASS: simplified pricing, readiness, ROI, app evidence, active-area validation, and fixed-price-only output.');
