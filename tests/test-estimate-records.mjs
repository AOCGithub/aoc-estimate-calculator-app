import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { webcrypto, randomUUID, createHmac } from 'node:crypto';
import { createRequire } from 'node:module';
import { handleAccessVerification, handleAccessStatus, handleJourneyCalculation } from '../server/api-handlers.mjs';
const require = createRequire(import.meta.url);
const fixture = require('./fixtures/commercial.cjs');
const engine = require('../public/journey-calculation.js');
const pricing = require('../public/approved-pricing.js');
const env = { AOC_ACCESS_GATE_ENABLED: 'true', AOC_ACCESS_REQUESTS_ENABLED: 'true', AOC_INTAKE_ONLY_ENABLED: 'true',
  AOC_ESTIMATE_RECORDS_ENABLED: 'true', AOC_MANUAL_ACCESS_ENABLED: 'false', AOC_APPROVED_EMAILS: '[]',
  AOC_ACCESS_SESSION_SECRET: 'synthetic-estimate-session-secret-more-than-32-characters',
  SUPABASE_URL: 'https://database.example.test', SUPABASE_SECRET_KEY: 'sb_secret_test' };
const originals = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
const originalFetch = globalThis.fetch;
const payload = { area: fixture.area, confirmed: true, answers: Object.fromEntries(Object.entries(fixture).filter(([key]) => !['area', 'process_confirmed'].includes(key))) };
const profile = { name: 'Test Person', company: 'Test Company', role: 'Testing', website: 'example.com', businessEmail: 'test@example.com', saveData: true };
let writes, fail;
async function provider(url, options) {
  const table = url.split('/').pop();
  assert.ok(['access_requests', 'estimates'].includes(table));
  assert.equal(options.method, 'POST');
  assert.equal(options.headers.apikey, env.SUPABASE_SECRET_KEY);
  if (fail && table === 'estimates') return Response.json({ error: 'sensitive provider detail' }, { status: 500 });
  writes.push({ table, body: JSON.parse(options.body) });
  return new Response(null, { status: 201 });
}
function request(path, body, cookie = '', origin = 'https://demo.test') {
  return new Request('https://demo.test' + path, { method: body === undefined ? 'GET' : 'POST',
    headers: { origin, cookie, 'content-type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
async function exercise(dispatch) {
  writes = []; fail = false;
  let response = await dispatch(request('/api/access/status'));
  assert.equal((await response.json()).recordsEnabled, true);
  const cookies = [];
  for (let i = 0; i < 2; i++) {
    response = await dispatch(request('/api/access/verify', { ...profile, id: randomUUID(), requestId: randomUUID(), review_status: 'approved' }));
    assert.equal(response.status, 200);
    cookies.push(response.headers.get('set-cookie').split(';')[0]);
  }
  const forms = writes.filter(row => row.table === 'access_requests').map(row => row.body);
  assert.notEqual(forms[0].id, forms[1].id);
  assert.equal(forms[0].review_status, 'pending');
  response = await dispatch(request('/api/journey/calculate', payload));
  assert.equal(response.status, 401);
  const beforeGuest = writes.length;
  response = await dispatch(request('/api/access/verify', { ...profile, saveData: false }));
  assert.equal(response.status, 200);
  const guestCookie = response.headers.get('set-cookie').split(';')[0];
  const guest = JSON.parse(Buffer.from(guestCookie.split('=')[1].split('.')[0], 'base64url').toString());
  assert.equal(guest.saveData, false);
  assert.equal(guest.requestId, undefined);
  assert.ok(!JSON.stringify(guest).includes(profile.businessEmail));
  for (const changed of [payload, { ...payload, answers: { ...payload.answers, team_time: 90 } }, { ...payload, saveData: true, access_request_id: forms[0].id }]) {
    response = await dispatch(request('/api/journey/calculate', changed, guestCookie));
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(data.result, engine.calculate(changed).result);
    assert.deepEqual(data.record, { saved: false, skipped: true });
  }
  assert.equal(writes.length, beforeGuest, 'No-save entry and repeated calculations must make zero database writes.');
  response = await dispatch(request('/api/access/status', undefined, guestCookie));
  assert.equal((await response.json()).saveData, false);
  const legacy = JSON.parse(Buffer.from(cookies[0].split('=')[1].split('.')[0], 'base64url').toString());
  delete legacy.saveData;
  const legacyPayload = Buffer.from(JSON.stringify(legacy)).toString('base64url');
  const legacyCookie = 'aoc_estimator_access=' + legacyPayload + '.' + createHmac('sha256', env.AOC_ACCESS_SESSION_SECRET).update(legacyPayload).digest('base64url');
  response = await dispatch(request('/api/journey/calculate', payload, legacyCookie));
  assert.equal((await response.json()).record.skipped, true, 'Older sessions cannot assume consent to new saves.');
  assert.equal(writes.length, beforeGuest);
  response = await dispatch(request('/api/journey/calculate', payload, cookies[0], 'https://evil.test'));
  assert.equal(response.status, 403);
  response = await dispatch(request('/api/journey/calculate', { ...payload, area: 'invalid' }, cookies[0]));
  assert.equal(response.status, 400);
  assert.equal(writes.filter(row => row.table === 'estimates').length, 0);
  for (let i = 0; i < 2; i++) {
    response = await dispatch(request('/api/journey/calculate', { ...payload, access_request_id: forms[1 - i].id, result: { total: 1 } }, cookies[i]));
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.deepEqual(data.result, engine.calculate(payload).result);
    assert.deepEqual(data.record, { saved: true });
    const record = writes.at(-1).body;
    assert.equal(record.access_request_id, forms[i].id, 'Owner must come from signed session, never body.');
    assert.deepEqual(record.answers, payload.answers);
    assert.deepEqual(record.result, data.result);
    assert.equal(record.pricing_version, pricing.version);
    assert.equal(record.calculator_version, data.version);
  }
  const modified = { ...payload, answers: { ...payload.answers, team_time: 90 } };
  response = await dispatch(request('/api/journey/calculate', modified, cookies[0]));
  assert.equal(response.status, 200);
  assert.equal(writes.at(-1).body.answers.team_time, 90);
  fail = true;
  response = await dispatch(request('/api/journey/calculate', payload, cookies[0]));
  const failure = await response.json();
  assert.equal(response.status, 200);
  assert.equal(failure.record.saved, false);
  assert.deepEqual(failure.result, engine.calculate(payload).result);
  assert.ok(!JSON.stringify(failure).includes('sensitive provider'));
  const tampered = cookies[0].slice(0, -4) + 'abcd';
  response = await dispatch(request('/api/journey/calculate', payload, tampered));
  assert.equal(response.status, 401);
}
try {
  Object.assign(process.env, env);
  globalThis.fetch = provider;
  await exercise(request => {
    const path = new URL(request.url).pathname;
    return path.endsWith('/status') ? handleAccessStatus(request) : path.endsWith('/verify') ? handleAccessVerification(request) : handleJourneyCalculation(request);
  });
  const source = await readFile(new URL('../dist/server/index.js', import.meta.url), 'utf8');
  const context = vm.createContext({ atob, btoa, Response, Request, URL, AbortSignal, crypto: webcrypto, TextEncoder, TextDecoder,
    FormData, Blob, structuredClone, setTimeout, clearTimeout, console, fetch: provider });
  vm.runInContext(source.replace(/export default\s*\{\s*async fetch/, 'globalThis.worker={async fetch'), context);
  await exercise(request => context.worker.fetch(request, env));
  console.log('PASS: Vercel/Worker linked snapshots, separate submissions, server-selected ownership/results, recalculation, rejected invalid/tampered requests, honest save failures.');
} finally {
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries(originals)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
}
