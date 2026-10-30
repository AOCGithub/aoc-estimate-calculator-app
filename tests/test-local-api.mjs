import assert from 'node:assert/strict';
import http from 'node:http';
import { createRequire } from 'node:module';
import { localApi } from '../server/local-api.mjs';
import calculationRoute from '../api/journey/calculate.mjs';

const require = createRequire(import.meta.url);
const fixture = require('./fixtures/commercial.cjs');
const engine = require('../public/journey-calculation.js');
const originalFetch = globalThis.fetch;
const environment = {
  AOC_ACCESS_GATE_ENABLED: 'true', AOC_ACCESS_REQUESTS_ENABLED: 'true', AOC_INTAKE_ONLY_ENABLED: 'true',
  AOC_ESTIMATE_RECORDS_ENABLED: 'true', AOC_MANUAL_ACCESS_ENABLED: 'false', AOC_APPROVED_EMAILS: '[]',
  AOC_ACCESS_SESSION_SECRET: 'synthetic-local-adapter-secret-more-than-32-characters',
  SUPABASE_URL: 'https://database.example.test', SUPABASE_SECRET_KEY: 'sb_secret_synthetic',
  AOC_AI_ORGANIZER_ENABLED: 'true', OPENAI_API_KEY: 'synthetic-provider-key', AOC_INTAKE_MODEL: 'synthetic-model',
};
const payload = { area: fixture.area, confirmed: true,
  answers: Object.fromEntries(Object.entries(fixture).filter(([key]) => !['area', 'process_confirmed'].includes(key))) };
const profile = { name: 'Synthetic Person', company: 'Example Company', website: 'example.com', role: 'Testing', businessEmail: 'not-approved@example.com', saveData: true };
const analysis = { title: 'Invoices', summary: 'Monthly invoices', solution: 'workflow', recommendationReason: 'Defined rules',
  classification: { steps: 2, variations: 1, decisions: null, reason: 'Several steps' }, routes: ['Create and send invoices'],
  facts: [{ id: 'systems', value: 'Wave', quote: 'Wave' }], relevantFields: [], uncertainties: [] };
let writes = [];
let failure = '';
let middleware;
localApi(environment).configureServer({ middlewares: { use(handler) { middleware = handler; } } });
const server = http.createServer((request, response) => middleware(request, response, () => response.writeHead(404).end()));
globalThis.fetch = async (url, options) => {
  if (url === 'https://api.openai.com/v1/responses') {
    assert.equal(options.headers.Authorization, 'Bearer ' + environment.OPENAI_API_KEY);
    const body = JSON.parse(options.body);
    assert.equal(body.model, environment.AOC_INTAKE_MODEL);
    assert.equal(body.store, false);
    assert.equal(body.text.format.type, 'json_schema');
    if (failure === 'ai') return Response.json({ error: 'synthetic provider error' }, { status: 429 });
    return Response.json({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify(analysis) }] }] });
  }
  assert.ok(url === environment.SUPABASE_URL + '/rest/v1/access_requests' || url === environment.SUPABASE_URL + '/rest/v1/estimates');
  assert.equal(options.method, 'POST');
  assert.equal(options.headers.apikey, environment.SUPABASE_SECRET_KEY);
  const table = url.split('/').pop();
  if (failure === table) return Response.json({ error: 'private storage details' }, { status: 500 });
  writes.push({ table, body: JSON.parse(options.body) });
  return new Response(null, { status: 201 });
};
try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const post = (path, body, cookie = '', extraHeaders = {}) => originalFetch(origin + path, { method: 'POST',
    headers: { origin, cookie, 'content-type': 'application/json', ...extraHeaders }, body: JSON.stringify(body) });
  let response = await originalFetch(origin + '/');
  assert.equal(response.status, 404, 'Non-API requests pass through to Vite.');
  response = await originalFetch(origin + '/api/access/status?check=1');
  assert.deepEqual(await response.json(), { enabled: true, configured: true, authenticated: false, requestsEnabled: true, intakeOnly: true, recordsEnabled: true, savingAvailable: true, saveData: false });
  assert.equal(response.headers.get('cache-control'), 'no-store');
  response = await originalFetch(origin + '/api/journey/calculate');
  assert.equal(response.status, 405);
  response = await post('/api/journey/calculate', payload);
  assert.equal(response.status, 401);
  response = await post('/api/access/verify', profile, '', { origin: 'https://evil.test' });
  assert.equal(response.status, 403);
  response = await post('/api/access/verify', { ...profile, company: '' });
  assert.equal(response.status, 400);
  response = await post('/api/access/verify', profile, '', { 'content-type': 'text/plain' });
  assert.equal(response.status, 415);
  failure = 'access_requests';
  response = await post('/api/access/verify', profile);
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('set-cookie'), null);
  failure = '';
  response = await post('/api/access/verify', profile);
  assert.equal(response.status, 200);
  const cookie = response.headers.get('set-cookie').split(';')[0];
  assert.match(response.headers.get('set-cookie'), /HttpOnly; SameSite=Lax/);
  const parent = writes[0].body.id;
  response = await post('/api/journey/calculate', payload, cookie);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ...engine.calculate(payload), source: 'server', record: { saved: true } });
  assert.equal(writes.at(-1).body.access_request_id, parent);
  response = await post('/api/journey/calculate', { ...payload, area: 'invalid' }, cookie);
  assert.equal(response.status, 400);
  response = await originalFetch(origin + '/api/journey/calculate', { method: 'POST', headers: { origin, cookie, 'content-type': 'application/json' }, body: 'not-json' });
  assert.equal(response.status, 400);
  response = await post('/api/journey/calculate', { ...payload, extra: 'x'.repeat(100001) }, cookie);
  assert.equal(response.status, 413);
  failure = 'estimates';
  response = await post('/api/journey/calculate', payload, cookie);
  assert.equal((await response.json()).record.saved, false);
  failure = '';
  response = await post('/api/journey/analyze', { area: 'area0', text: 'We prepare 40 invoices in Wave each month.' }, cookie);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).analysis.facts[0].value, 'Wave');
  failure = 'ai';
  response = await post('/api/journey/analyze', { area: 'area0', text: 'We prepare 40 invoices in Wave each month.' }, cookie);
  assert.equal(response.status, 429);
  failure = '';
  environment.AOC_AI_ORGANIZER_ENABLED = 'false';
  response = await post('/api/journey/analyze', {}, cookie);
  assert.deepEqual(await response.json(), { localFallback: true, mode: 'local' });
  response = await post('/api/access/redeem', { token: 'a'.repeat(64) });
  assert.equal(response.status, 404);
  response = await post('/api/access/logout', {}, cookie);
  assert.match(response.headers.get('set-cookie'), /Max-Age=0/);
  environment.AOC_INTAKE_ONLY_ENABLED = 'false';
  response = await originalFetch(origin + '/api/access/status', { headers: { cookie } });
  assert.equal((await response.json()).authenticated, false, 'Restoring review must not accept temporary cookies.');
  response = await calculationRoute.fetch(new Request('https://adapter.test/api/journey/calculate', {
    method: 'POST', headers: { origin: 'https://adapter.test', 'content-type': 'application/json' }, body: JSON.stringify(payload),
  }), { AOC_ACCESS_GATE_ENABLED: 'true' });
  assert.equal(response.status, 200, 'Vercel context must not be confused with injected local settings.');
  console.log('PASS: Shared HTTP adapter, local environment isolation, streamed JSON/size limits, methods, origin/session guards, save failures, AI contract/fallback, cookies, and Vercel context compatibility. No live providers.');
} finally {
  globalThis.fetch = originalFetch;
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
