import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import vm from 'node:vm';
import { handleAccessVerification, handleAccessStatus, handleJourneyCalculation } from '../server/api-handlers.mjs';
import AccessRequests from '../server/access-requests.cjs';

const environment = {
  AOC_ACCESS_GATE_ENABLED: 'true', AOC_ACCESS_REQUESTS_ENABLED: 'true',
  AOC_ACCESS_SESSION_SECRET: 'synthetic-test-session-secret-not-used-outside-tests',
  AOC_APPROVED_EMAILS: '["approved@example.com"]',
  SUPABASE_URL: 'https://database.example.test', SUPABASE_SECRET_KEY: 'sb_secret_synthetic_test_only',
};
const originalEnvironment = Object.fromEntries([...Object.keys(environment), 'SUPABASE_SERVICE_ROLE_KEY'].map(key => [key, process.env[key]]));
const originalFetch = globalThis.fetch;
const writes = [];
let failure = false;
const provider = async (url, options) => {
  assert.equal(url, environment.SUPABASE_URL + '/rest/v1/access_requests');
  assert.equal(options.method, 'POST');
  assert.equal(options.headers.apikey, environment.SUPABASE_SECRET_KEY);
  assert.equal(options.headers.Authorization, undefined, 'Modern secret keys must not be used as JWTs.');
  assert.equal(options.headers.Prefer, 'return=minimal');
  assert.ok(options.signal instanceof AbortSignal);
  if (failure === 'network') throw new Error('Synthetic private provider error');
  if (failure) return Response.json({ error: 'Synthetic private provider error' }, { status: 500 });
  writes.push(JSON.parse(options.body));
  return new Response(null, { status: 201 });
};
const profile = { name: 'Test Request', company: 'Example Company', website: 'example.com', role: 'Tester', businessEmail: 'pending@example.com' };
const request = (body = profile, origin = 'https://demo.test') => new Request('https://demo.test/api/access/verify', {
  method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body),
});

async function exercise(verify, status, calculate, env) {
  writes.length = 0;
  let response = await verify(request({ ...profile, review_status: 'approved', approved: true }), env);
  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), { enabled: true, authenticated: false, pending: true });
  assert.equal(response.headers.get('set-cookie'), null);
  assert.deepEqual(writes, [{ name: profile.name, company: profile.company, website: 'https://example.com/',
    role: profile.role, business_email: profile.businessEmail, review_status: 'pending' }], 'Only the five validated fields and server-controlled status are saved.');
  response = await calculate(new Request('https://demo.test/api/journey/calculate', {
    method: 'POST', headers: { origin: 'https://demo.test', 'content-type': 'application/json' }, body: '{}',
  }), env);
  assert.equal(response.status, 401, 'Pending requests must not open the calculator API.');
  assert.equal((await (await status(new Request('https://demo.test/api/access/status'), env)).json()).requestsEnabled, true);
  response = await verify(request({ ...profile, businessEmail: 'APPROVED@example.com' }), env);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('set-cookie'), /HttpOnly.*SameSite=Lax.*Secure/);
  assert.equal(writes.length, 2, 'Approved visitors also have their valid request saved.');
  response = await verify(request({ ...profile, company: '' }), env);
  assert.equal(response.status, 400);
  response = await verify(request(profile, 'https://other.test'), env);
  assert.equal(response.status, 403);
  assert.equal(writes.length, 2, 'Invalid and cross-origin requests must not be stored.');
  for (failure of [true, 'network']) {
    response = await verify(request({ ...profile, businessEmail: 'approved@example.com' }), env);
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('set-cookie'), null);
    const error = await response.json();
    assert.match(error.error, /could not save/);
    assert.ok(!JSON.stringify(error).includes('private provider'), 'Provider details must not leak.');
  }
  failure = false;
  let limited = false;
  for (let attempt = 0; attempt < 31; attempt += 1) {
    const next = request();
    next.headers.set('oai-authenticated-user-id', 'untrusted-' + attempt);
    response = await verify(next, env);
    if (response.status === 429) { limited = true; break; }
    assert.equal(response.status, 202);
  }
  assert.equal(limited, true, 'Caller-supplied identity headers must not bypass the attempt limit.');
  const savedCount = writes.length;
  response = await verify(request(), env);
  assert.equal(response.status, 429);
  assert.equal(writes.length, savedCount, 'Rate-limited attempts must not write records.');
}

try {
  Object.assign(process.env, environment);
  globalThis.fetch = provider;
  await exercise(handleAccessVerification, handleAccessStatus, handleJourneyCalculation);
  process.env.AOC_APPROVED_EMAILS = '[]';
  assert.equal((await handleAccessStatus(new Request('https://demo.test/api/access/status')).json()).configured, true, 'Requests can be collected before anyone is approved.');
  process.env.SUPABASE_SECRET_KEY = '';
  process.env.SUPABASE_SERVICE_ROLE_KEY = '';
  assert.equal((await handleAccessStatus(new Request('https://demo.test/api/access/status')).json()).configured, false);

  const source = await readFile(new URL('../dist/server/index.js', import.meta.url), 'utf8');
  const context = vm.createContext({ atob, btoa, Response, Request, URL, AbortSignal, crypto: webcrypto,
    TextEncoder, TextDecoder, FormData, Blob, structuredClone, setTimeout, clearTimeout, console, fetch: provider });
  vm.runInContext(source.replace(/export default\s*\{\s*async fetch/, 'globalThis.worker={async fetch'), context);
  const dispatch = (request, env) => context.worker.fetch(request, env);
  await exercise(dispatch, dispatch, dispatch, environment);

  const legacy = AccessRequests.configuration({ AOC_ACCESS_REQUESTS_ENABLED: 'true', SUPABASE_URL: 'https://database.example.test', SUPABASE_SERVICE_ROLE_KEY: 'legacy-synthetic-key' });
  globalThis.fetch = async (_, options) => {
    assert.equal(options.headers.Authorization, 'Bearer legacy-synthetic-key');
    return new Response(null, { status: 201 });
  };
  await AccessRequests.save(legacy, profile);
  console.log('PASS: Vercel and Worker request persistence, pending approval, validation, fail-closed errors, modern/legacy keys, and unchanged signed access.');
} finally {
  globalThis.fetch = originalFetch;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  for (const [key, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
