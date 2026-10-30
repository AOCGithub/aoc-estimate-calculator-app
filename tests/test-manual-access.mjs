import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { handleAccessStatus, handleAccessVerification, handleAccessRedemption, handleAccessLogout, handleJourneyCalculation } from '../server/api-handlers.mjs';

const require = createRequire(import.meta.url);
const fixture = require('./fixtures/commercial.cjs');
const engine = require('../public/journey-calculation.js');
const env = { AOC_ACCESS_GATE_ENABLED: 'true', AOC_ACCESS_REQUESTS_ENABLED: 'true', AOC_MANUAL_ACCESS_ENABLED: 'true',
  AOC_APPROVED_EMAILS: '["approved@example.com"]', SUPABASE_URL: 'https://private.example.test', SUPABASE_SECRET_KEY: 'sb_secret_test_only' };
const original = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
const originalFetch = globalThis.fetch;
const hash = value => createHash('sha256').update(value).digest('hex');
const profile = { name: 'Manual Test', company: 'Example Company', role: 'Test role', website: 'example.com', businessEmail: 'approved@example.com' };
const requestId = '00000000-0000-4000-a000-000000000001';
const rawInvite = 'a'.repeat(64);
let decision, used, fail, activeSessionHash, sessionExpires, stored;
function reset() {
  decision = 'pending'; used = false; fail = false; activeSessionHash = ''; sessionExpires = new Date(Date.now() + 3600000).toISOString(); stored = [];
}
const provider = async (address, options = {}) => {
  assert.equal(options.headers.apikey, env.SUPABASE_SECRET_KEY);
  assert.equal(options.headers.Authorization, undefined);
  const url = new URL(address);
  assert.equal(url.origin, env.SUPABASE_URL);
  if (fail) return Response.json({ error: 'Private provider details' }, { status: 500 });
  if (url.pathname.endsWith('/rpc/redeem_access_invitation')) {
    const body = JSON.parse(options.body);
    assert.equal(body.p_hours, 8);
    if (decision !== 'approved' || used || body.p_token_hash !== hash(rawInvite)) return Response.json([]);
    used = true;
    activeSessionHash = body.p_session_hash;
    assert.match(activeSessionHash, /^[a-f0-9]{64}$/);
    assert.notEqual(activeSessionHash, hash(rawInvite));
    return Response.json([{ request_id: requestId }]);
  }
  if (url.pathname.endsWith('/access_requests')) {
    if (options.method === 'POST') {
      stored.push(JSON.parse(options.body));
      return new Response(null, { status: 201 });
    }
    assert.equal(url.searchParams.get('id'), 'eq.' + requestId);
    return Response.json([{ review_status: decision }]);
  }
  if (url.pathname.endsWith('/access_invitations')) {
    const matches = url.searchParams.get('session_hash') === 'eq.' + activeSessionHash;
    if (options.method === 'PATCH') {
      assert.deepEqual(JSON.parse(options.body), { session_hash: null, session_expires_at: null });
      if (matches) activeSessionHash = '';
      return new Response(null, { status: 204 });
    }
    return Response.json(matches ? [{ request_id: requestId, session_expires_at: sessionExpires }] : []);
  }
  throw new Error('Unexpected provider path');
};
function request(path, body, headers = {}, method = body === undefined ? 'GET' : 'POST') {
  return new Request('https://demo.test' + path, { method, headers: { origin: 'https://demo.test',
    ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
async function exercise(dispatch) {
  reset();
  let response = await dispatch(request('/api/access/status'));
  assert.deepEqual(await response.json(), { enabled: true, requestsEnabled: true, manualApproval: true, configured: true, authenticated: false });
  response = await dispatch(request('/api/access/verify', { ...profile, review_status: 'approved' }));
  assert.equal(response.status, 202, 'Even an email on the old allowlist must wait.');
  assert.equal(response.headers.get('set-cookie'), null);
  assert.deepEqual(stored, [{ name: profile.name, company: profile.company, website: 'https://example.com/', role: profile.role,
    business_email: profile.businessEmail, review_status: 'pending' }]);
  response = await dispatch(request('/api/access/verify', { ...profile, name: '' }));
  assert.equal(response.status, 400);
  assert.equal(stored.length, 1);
  response = await dispatch(request('/api/access/redeem', { token: rawInvite }, { origin: 'https://other.test' }));
  assert.equal(response.status, 403);
  for (const token of ['', 'short', { toString: 'bad' }]) {
    response = await dispatch(request('/api/access/redeem', { token }));
    assert.equal(response.status, 400);
  }
  response = await dispatch(request('/api/access/redeem', { token: rawInvite }));
  assert.equal(response.status, 403, 'Pending requests cannot redeem an invitation.');
  decision = 'approved';
  response = await dispatch(request('/api/journey/calculate', {}));
  assert.equal(response.status, 401, 'Approval without a secret link is not a session.');
  response = await dispatch(request('/api/access/redeem', { token: rawInvite }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { enabled: true, authenticated: true });
  const setCookie = response.headers.get('set-cookie');
  assert.match(setCookie, /HttpOnly.*SameSite=Lax.*Secure/);
  assert.ok(!setCookie.includes(profile.businessEmail) && !setCookie.includes(rawInvite));
  const cookie = setCookie.split(';')[0];
  response = await dispatch(request('/api/access/status', undefined, { cookie }));
  assert.equal((await response.json()).authenticated, true);
  response = await dispatch(request('/api/access/redeem', { token: rawInvite }));
  assert.equal(response.status, 403, 'Invitations cannot be reused.');
  const payload = { area: fixture.area, confirmed: true, answers: Object.fromEntries(Object.entries(fixture).filter(([key]) => !['area', 'process_confirmed'].includes(key))) };
  response = await dispatch(request('/api/journey/calculate', payload, { cookie }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ...engine.calculate(payload), source: 'server' });
  decision = 'revoked';
  response = await dispatch(request('/api/journey/calculate', payload, { cookie }));
  assert.equal(response.status, 401, 'Decision changes are checked server-side on every calculation.');
  decision = 'approved';
  sessionExpires = new Date(Date.now() - 1000).toISOString();
  response = await dispatch(request('/api/access/status', undefined, { cookie }));
  assert.equal((await response.json()).authenticated, false);
  sessionExpires = new Date(Date.now() + 3600000).toISOString();
  fail = true;
  response = await dispatch(request('/api/journey/calculate', payload, { cookie }));
  assert.equal(response.status, 503, 'Database failures must not grant access.');
  response = await dispatch(request('/api/access/verify', profile));
  assert.equal(response.status, 503);
  assert.ok(!(await response.text()).includes('Private provider details'));
  fail = false;
  response = await dispatch(request('/api/access/logout', {}, { cookie }));
  assert.equal(response.status, 200);
  assert.match(response.headers.get('set-cookie'), /Max-Age=0/);
  response = await dispatch(request('/api/access/status', undefined, { cookie }));
  assert.equal((await response.json()).authenticated, false, 'Logout also invalidates copied session cookies in the database.');
}
try {
  Object.assign(process.env, env);
  globalThis.fetch = provider;
  const nodeDispatch = request => {
    const action = new URL(request.url).pathname;
    if (action.endsWith('/status')) return handleAccessStatus(request);
    if (action.endsWith('/verify')) return handleAccessVerification(request);
    if (action.endsWith('/redeem')) return handleAccessRedemption(request);
    if (action.endsWith('/logout')) return handleAccessLogout(request);
    return handleJourneyCalculation(request);
  };
  await exercise(nodeDispatch);
  const source = await readFile(new URL('../dist/server/index.js', import.meta.url), 'utf8');
  const context = vm.createContext({ atob, btoa, Response, Request, URL, AbortSignal, crypto: webcrypto,
    TextEncoder, TextDecoder, FormData, Blob, structuredClone, setTimeout, clearTimeout, console, fetch: provider });
  vm.runInContext(source.replace(/export default\s*\{\s*async fetch/, 'globalThis.worker={async fetch'), context);
  await exercise(request => context.worker.fetch(request, env));
  process.env.AOC_MANUAL_ACCESS_ENABLED = 'false';
  assert.equal((await handleAccessRedemption(request('/api/access/redeem', { token: rawInvite }))).status, 404);
  console.log('PASS: Vercel/Worker manual requests, no allowlist bypass, server approval checks, single-use secrets, validation, fail-closed errors, sessions, revocation, calculator parity and rollback flag.');
} finally {
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
}
