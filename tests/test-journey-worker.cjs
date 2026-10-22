const fs = require('fs');
const assert = require('assert/strict');
const vm = require('vm');

const source = fs.readFileSync('dist/server/index.js', 'utf8');
assert.ok(source.includes('/api/intake/'));
assert.ok(source.includes('gpt-4o-mini-transcribe'));
const code = source.replace(/export default\s*\{\s*async fetch/, 'globalThis.worker={async fetch');
const context = {
  atob,
  Response,
  Request,
  URL,
  AbortSignal,
  FormData,
  Blob,
  structuredClone,
  setTimeout,
  clearTimeout,
  console,
  fetch: async () => { throw Error('No real API call in this test'); },
};
vm.createContext(context);
vm.runInContext(code, context);

(async () => {
  let response = await context.worker.fetch(new Request('https://demo.test/'), {});
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.ok(html.includes('id="root"'));
  assert.ok(html.includes('/assets/'));
  assert.ok(html.includes('href="/favicon.png"'));
  const favicon = await context.worker.fetch(new Request('https://demo.test/favicon.png'), {});
  assert.equal(favicon.status, 200);
  assert.equal(favicon.headers.get('content-type'), 'image/png');
  assert.deepEqual(Buffer.from(await favicon.arrayBuffer()), fs.readFileSync('public/favicon.png'), 'packaged favicon preserves the original AOC image bytes');

  for (const match of html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)) {
    const asset = await context.worker.fetch(new Request('https://demo.test' + match[1]), {});
    assert.equal(asset.status, 200, match[1]);
  }

  response = await context.worker.fetch(new Request('https://demo.test/api/intake/status'), {});
  assert.equal(response.status, 200);
  assert.equal((await response.json()).configured, false);
  response = await context.worker.fetch(new Request('https://demo.test/api/intake/analyze', {
    method: 'POST',
    headers: { origin: 'https://demo.test', 'content-type': 'application/json' },
    body: JSON.stringify({ text: 'A sufficiently detailed historical intake description for this retained API route.' }),
  }), {});
  assert.equal(response.status, 503);
  response = await context.worker.fetch(new Request('https://demo.test/api/intake/transcribe', {
    method: 'POST',
    headers: { origin: 'https://demo.test' },
  }), {});
  assert.equal(response.status, 503);

  response = await context.worker.fetch(new Request('https://demo.test/api/journey/analyze', {
    method: 'POST',
    headers: { origin: 'https://evil.test', 'content-type': 'application/json' },
    body: '{}',
  }), {});
  assert.equal(response.status, 403);

  response = await context.worker.fetch(new Request('https://demo.test/api/journey/analyze', {
    method: 'POST',
    headers: { origin: 'https://demo.test', 'content-type': 'application/json' },
    body: '{}',
  }), {});
  assert.equal(response.status, 200);
  assert.equal((await response.json()).localFallback, true);

  response = await context.worker.fetch(new Request('https://demo.test/api/journey/calculate', {
    method: 'POST',
    headers: { origin: 'https://evil.test', 'content-type': 'application/json' },
    body: '{}',
  }), {});
  assert.equal(response.status, 403);

  const calculation = {
    area: 'area0',
    confirmed: true,
    answers: {
      ...Object.fromEntries(Object.entries(require('./fixtures/commercial.cjs')).filter(([key])=>!['area','process_confirmed','management'].includes(key))),
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
      responsibility_split: 'client',
      management: 'yes',
      team_time: 40,
      blended_hourly_cost: 50,
      software_replaced_portion: 'none',
      incremental_software_cost: 0,
    },
  };
  response = await context.worker.fetch(new Request('https://demo.test/api/journey/calculate', {
    method: 'POST',
    headers: { origin: 'https://demo.test', 'content-type': 'application/json' },
    body: JSON.stringify(calculation),
  }), {});
  assert.equal(response.status, 200);
  const calculated = await response.json();
  assert.equal(calculated.source, 'server');
  assert.equal(calculated.result.build, 11500);
  assert.equal(calculated.result.audit, 1250);
  assert.equal(calculated.result.monthly, 0);

  const invalidCalculation = structuredClone(calculation);
  invalidCalculation.answers.legacy_system_check = 'INVALID';
  response = await context.worker.fetch(new Request('https://demo.test/api/journey/calculate', {
    method: 'POST',
    headers: { origin: 'https://demo.test', 'content-type': 'application/json' },
    body: JSON.stringify(invalidCalculation),
  }), {});
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /Invalid choice/);

  const text = 'We prepare 40 invoices in Wave each month.';
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
  context.fetch = async (url, options) => {
    const payload = JSON.parse(options.body);
    assert.equal(payload.store, false);
    assert.ok(payload.text.format.schema.properties.facts);
    assert.ok(payload.instructions.includes('FIELD BANK'));
    return Response.json({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify(output) }] }] });
  };
  response = await context.worker.fetch(new Request('https://demo.test/api/journey/analyze', {
    method: 'POST',
    headers: { origin: 'https://demo.test', 'content-type': 'application/json' },
    body: JSON.stringify({ area: 'area0', text }),
  }), { OPENAI_API_KEY: 'test-placeholder-not-real', AOC_AI_ORGANIZER_ENABLED: 'true' });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).analysis.facts.length, 2);

  console.log('PASS: built Worker serves the React journey, retains historical intake routes, and validates authoritative calculation, origin guards, fallback, and structured extraction.');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
