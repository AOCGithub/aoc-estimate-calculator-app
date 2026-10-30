import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import { createRequire } from 'node:module';
import { handleAccessStatus, handleAccessVerification, handleAccessRedemption, handleAccessLogout, handleJourneyCalculation } from '../server/api-handlers.mjs';

const require = createRequire(import.meta.url);
const fixture = require('./fixtures/commercial.cjs');
const engine = require('../public/journey-calculation.js');
const env = { AOC_ACCESS_GATE_ENABLED: 'true', AOC_ACCESS_REQUESTS_ENABLED: 'true', AOC_INTAKE_ONLY_ENABLED: 'true',
  AOC_MANUAL_ACCESS_ENABLED: 'true', AOC_ACCESS_SESSION_SECRET: 'synthetic-intake-session-secret-over-32-characters',
  AOC_APPROVED_EMAILS: '[]', AOC_ACCESS_SESSION_HOURS: '8', SUPABASE_URL: 'https://database.example.test', SUPABASE_SECRET_KEY: 'sb_secret_test_only' };
const originals = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
const previousFetch = globalThis.fetch;
const profile = { name: 'Intake Test', company: 'Example Company', website: 'example.com', role: 'Testing', businessEmail: 'not-approved@example.com' };
const payload = { area: fixture.area, confirmed: true, answers: Object.fromEntries(Object.entries(fixture).filter(([key]) => !['area', 'process_confirmed'].includes(key))) };
let writes = [];
let failure = false;
const provider = async (url, options) => {
  assert.equal(url, env.SUPABASE_URL + '/rest/v1/access_requests', 'No approval, invitation or authentication API is needed.');
  assert.equal(options.method, 'POST');
  assert.equal(options.headers.apikey, env.SUPABASE_SECRET_KEY);
  if (failure) return Response.json({ error: 'Private provider details' }, { status: 500 });
  writes.push(JSON.parse(options.body));
  return new Response(null, { status: 201 });
};
function request(path, value, headers = {}, method = value === undefined ? 'GET' : 'POST') {
  return new Request('https://demo.test' + path, { method, headers: { origin: 'https://demo.test',
    ...(value === undefined ? {} : { 'content-type': 'application/json' }), ...headers },
    ...(value === undefined ? {} : { body: JSON.stringify(value) }) });
}
async function exercise(dispatch, settings) {
  writes = []; failure = false;
  let response = await dispatch(request('/api/access/status'), settings);
  assert.deepEqual(await response.json(), { enabled: true, configured: true, authenticated: false, requestsEnabled: true, intakeOnly: true });
  response = await dispatch(request('/api/journey/calculate', payload), settings);
  assert.equal(response.status, 401, 'A saved-intake session is still required for the API.');
  response = await dispatch(request('/api/access/verify', { ...profile, company: '' }), settings);
  assert.equal(response.status, 400);
  response = await dispatch(request('/api/access/verify', profile, { origin: 'https://elsewhere.test' }), settings);
  assert.equal(response.status, 403);
  assert.equal(writes.length, 0);
  failure = true;
  response = await dispatch(request('/api/access/verify', profile), settings);
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('set-cookie'), null, 'Saving must succeed before a session is created.');
  assert.ok(!(await response.text()).includes('Private provider details'));
  failure = false;
  response = await dispatch(request('/api/access/verify', { ...profile, review_status: 'approved', verified: true }), settings);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { enabled: true, authenticated: true });
  assert.deepEqual(writes, [{ name: profile.name, company: profile.company, website: 'https://example.com/', role: profile.role,
    business_email: profile.businessEmail, review_status: 'pending' }], 'Access does not pretend verification or change approval status.');
  const setCookie = response.headers.get('set-cookie');
  assert.match(setCookie, /HttpOnly.*SameSite=Lax.*Secure/);
  assert.ok(!setCookie.includes(profile.businessEmail));
  const cookie = setCookie.split(';')[0];
  response = await dispatch(request('/api/access/status', undefined, { cookie }), settings);
  assert.equal((await response.json()).authenticated, true);
  response = await dispatch(request('/api/journey/calculate', payload, { cookie }), settings);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ...engine.calculate(payload), source: 'server' });
  response = await dispatch(request('/api/access/redeem', { token: 'a'.repeat(64) }), settings);
  assert.equal(response.status, 404, 'Paused private-link workflow must stay inactive.');
  response = await dispatch(request('/api/access/logout', {}, { cookie }), settings);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('set-cookie'), /Max-Age=0/);
  const withoutIntake = { ...settings, AOC_INTAKE_ONLY_ENABLED: 'false', AOC_MANUAL_ACCESS_ENABLED: 'false', AOC_APPROVED_EMAILS: JSON.stringify([profile.businessEmail]) };
  response = await dispatch(request('/api/access/status', undefined, { cookie }), withoutIntake);
  assert.equal((await response.json()).authenticated, false, 'A temporary intake cookie cannot bypass restored review/allowlist mode.');
  response = await dispatch(request('/api/access/status', undefined, { cookie }), { ...withoutIntake, AOC_MANUAL_ACCESS_ENABLED: 'true' });
  assert.equal((await response.json()).authenticated, false);
  response = await dispatch(request('/api/access/status'), { ...settings, AOC_ACCESS_REQUESTS_ENABLED: 'false' });
  assert.equal((await response.json()).configured, false, 'Intake-only mode cannot silently skip saving.');
}
try {
  globalThis.fetch = provider;
  const dispatch = (request, settings) => {
    Object.assign(process.env, settings);
    const path = new URL(request.url).pathname;
    if (path.endsWith('/status')) return handleAccessStatus(request);
    if (path.endsWith('/verify')) return handleAccessVerification(request);
    if (path.endsWith('/redeem')) return handleAccessRedemption(request);
    if (path.endsWith('/logout')) return handleAccessLogout(request);
    return handleJourneyCalculation(request);
  };
  await exercise(dispatch, env);
  const source = await readFile(new URL('../dist/server/index.js', import.meta.url), 'utf8');
  const context = vm.createContext({ atob, btoa, Response, Request, URL, AbortSignal, crypto: webcrypto,
    TextEncoder, TextDecoder, FormData, Blob, structuredClone, setTimeout, clearTimeout, console, fetch: provider });
  vm.runInContext(source.replace(/export default\s*\{\s*async fetch/, 'globalThis.worker={async fetch'), context);
  await exercise((request, settings) => context.worker.fetch(request, settings), env);
  console.log('PASS: Vercel/Worker save-before-entry, no approvals or verification, pending records preserved, protected signed sessions, calculator parity, errors, and safe restoration of review mode.');
} finally {
  globalThis.fetch = previousFetch;
  for (const [key, value] of Object.entries(originals)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
}
