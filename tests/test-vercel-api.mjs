import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import calculationRoute from '../api/journey/calculate.mjs';
import analysisRoute from '../api/journey/analyze.mjs';
import intakeStatusRoute from '../api/intake/status.mjs';
import intakeTranscriptionRoute from '../api/intake/transcribe.mjs';

const originalFetch = globalThis.fetch;
const originalKey = process.env.OPENAI_API_KEY;
const originalEnabled = process.env.AOC_AI_ORGANIZER_ENABLED;
const origin = 'https://aoc-estimate-calculator-app.vercel.app';

try {
  const calculation = {
    area: 'area0',
    confirmed: true,
    answers: {
      solution: 'workflow',
      steps_band: 3,
      variation_band: 3,
      documentation_readiness: 'Notes or examples',
      data_preparation_level: 'Some preparation',
      systems: ['Hubstaff Time', 'Wave', 'Google Docs', 'Google Drive', 'Help Scout', 'Stripe'],
      action_mode: 'approved',
      consequential: 'yes',
      people_count: 3,
      department_count: 2,
      handover: 'group',
      legacy_system_check: 'Standard',
      cadence: 'monthly',
      responsibility_split: 'aoc',
      tier: 'priority',
      team_time: 40,
      blended_hourly_cost: 50,
      software_replaced_portion: 'none',
      incremental_software_cost: 0,
    },
  };
  let response = await calculationRoute.fetch(new Request(`${origin}/api/journey/calculate`, {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify(calculation),
  }));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.source, 'server');
  assert.equal(result.result.build, 11500);
  assert.equal(result.result.audit, 1150);
  assert.equal(result.result.monthly, 550);

  response = await calculationRoute.fetch(new Request(`${origin}/api/journey/calculate`, {
    method: 'POST',
    headers: { origin: 'https://evil.test', 'content-type': 'application/json' },
    body: JSON.stringify(calculation),
  }));
  assert.equal(response.status, 403);

  delete process.env.OPENAI_API_KEY;
  process.env.AOC_AI_ORGANIZER_ENABLED = 'false';
  response = await analysisRoute.fetch(new Request(`${origin}/api/journey/analyze`, {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify({ area: 'area0', text: 'We prepare 40 invoices in Wave each month.' }),
  }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).localFallback, true);

  response = await intakeStatusRoute.fetch(new Request(`${origin}/api/intake/status`));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).configured, false);

  response = await intakeTranscriptionRoute.fetch(new Request(`${origin}/api/intake/transcribe`, {
    method: 'POST',
    headers: { origin },
  }));
  assert.equal(response.status, 503);

  process.env.OPENAI_API_KEY = 'test-placeholder-not-real';
  process.env.AOC_AI_ORGANIZER_ENABLED = 'true';
  const output = {
    title: 'Invoice preparation',
    summary: 'Monthly invoice preparation',
    solution: 'workflow',
    recommendationReason: 'Defined rules',
    classification: { steps: 2, variations: 1, decisions: null, reason: 'Several steps' },
    routes: ['Create and send invoices'],
    facts: [
      { id: 'invoice_volume', value: '40', quote: '40 invoices' },
      { id: 'systems', value: 'Wave', quote: 'Wave' },
    ],
    relevantFields: ['invoice_volume'],
    uncertainties: [],
  };
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    const body = JSON.parse(options.body);
    assert.equal(body.store, false);
    assert.ok(body.text.format.schema.properties.facts);
    return Response.json({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify(output) }] }] });
  };
  response = await analysisRoute.fetch(new Request(`${origin}/api/journey/analyze`, {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify({ area: 'area0', text: 'We prepare 40 invoices in Wave each month.' }),
  }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).analysis.facts.length, 2);

  const unknownResponsibility = 'We do not yet know who should manage it. Please help us identify the missing details.';
  output.facts = [{ id: 'responsibility_split', value: 'help', quote: unknownResponsibility }];
  response = await analysisRoute.fetch(new Request(`${origin}/api/journey/analyze`, {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify({ area: 'area0', text: unknownResponsibility }),
  }));
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).analysis.facts, [], 'API removes unsupported management-help choices');

  const explicitManagementHelp = 'Please help us decide who should manage the process.';
  output.facts = [{ id: 'responsibility_split', value: 'help', quote: explicitManagementHelp }];
  response = await analysisRoute.fetch(new Request(`${origin}/api/journey/analyze`, {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify({ area: 'area0', text: explicitManagementHelp }),
  }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).analysis.facts[0].value, 'help', 'API preserves explicit management-help requests');

  for (const [text, value, expected] of [
    ['A person must approve every reply in Help Scout.', 'approved', []],
    ['We need draft replies in Help Scout. A person must approve every reply.', 'approved', ['draft']],
    ['We need draft replies in Help Scout. A person must approve every reply.', 'draft', ['draft']],
    ['Make changes only after our approval.', 'approved', ['approved']],
    ['The agent drafts replies, then sends them once approved.', 'approved', ['approved']],
    ['Send routine replies automatically within agreed limits.', 'automatic', ['automatic']],
  ]) {
    output.facts = [{ id: 'action_mode', value, quote: text }];
    response = await analysisRoute.fetch(new Request(`${origin}/api/journey/analyze`, {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json' },
      body: JSON.stringify({ area: 'area1', text }),
    }));
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).analysis.facts.map(fact => fact.value), expected, 'API keeps drafting separate from execution');
  }

  const vercelConfig = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.equal(vercelConfig.framework, 'vite');
  assert.equal(vercelConfig.outputDirectory, 'dist/client');
  assert.ok(vercelConfig.headers.some(rule => rule.headers.some(header => header.key === 'Content-Security-Policy')));

  console.log('PASS: Vercel calculation, organizer fallback/provider contract, retained status, origin guard, output path, and security configuration.');
} finally {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalKey;
  if (originalEnabled === undefined) delete process.env.AOC_AI_ORGANIZER_ENABLED;
  else process.env.AOC_AI_ORGANIZER_ENABLED = originalEnabled;
}
