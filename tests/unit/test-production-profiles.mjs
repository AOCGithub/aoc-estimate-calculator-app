import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { handleClientProfile, handleProfileCleanup, createSupabaseProfileStore, profileConfiguration } from '../../server/profiles/client-profiles.mjs';
const environment = { AOC_CLIENT_PROFILES_ENABLED: 'true', AOC_ACCESS_GATE_ENABLED: 'true', AOC_INTAKE_ONLY_ENABLED: 'true',
  SUPABASE_URL: 'https://profile-storage.example.invalid', SUPABASE_SECRET_KEY: 'sb_secret_synthetic_only', CRON_SECRET: 'synthetic-cron-secret-'.repeat(3) };
const origin = 'https://estimator.example.test';
const profile = { name: 'Production Profile Test', company: 'Example Test', website: 'example.com', role: 'Testing', businessEmail: 'profiles@example.com' };
const body = { profile, consent: true, confirmed: true };
const originalFetch = globalThis.fetch;
const rows = new Map();
let failWrites = false, calls = 0;
const json = value => Response.json(structuredClone(value));
globalThis.fetch = async (target, options = {}) => {
  calls++;
  const url = new URL(target);
  assert.equal(url.origin, environment.SUPABASE_URL);
  const headers = new Headers(options.headers);
  assert.equal(headers.get('apikey'), environment.SUPABASE_SECRET_KEY);
  assert.equal(headers.has('authorization'), false, 'modern secret keys are server-only apikey credentials');
  if (url.pathname === '/rest/v1/rpc/purge_expired_client_profiles') {
    for (const [hash,row] of rows) if (Date.parse(row.expires_at) <= Date.now()) rows.delete(hash);
    return new Response(null, { status: 204 });
  }
  assert.equal(url.pathname, '/rest/v1/client_profiles');
  const matches = [...rows.values()].filter(row => [...url.searchParams].every(([key,value]) => {
    if (key === 'select' || key === 'limit') return true;
    const [op,...pieces] = value.split('.'), expected = pieces.join('.');
    return op === 'eq' ? row[key] === expected : op === 'gt' ? Date.parse(row[key]) > Date.parse(expected) : op === 'lte' ? Date.parse(row[key]) <= Date.parse(expected) : false;
  }));
  if (options.method === 'GET') return json(matches);
  if (failWrites) return Response.json({ error: 'private backend failure with sensitive details' }, { status: 503 });
  if (options.method === 'DELETE') {
    for (const row of matches) rows.delete(row.token_hash);
    return headers.get('prefer') === 'return=representation' ? json(matches) : new Response(null, { status: 204 });
  }
  const data = JSON.parse(options.body);
  if (options.method === 'POST') {
    if (rows.has(data.token_hash)) return new Response(null, { status: 409 });
    rows.set(data.token_hash, structuredClone(data)); return json([data]);
  }
  assert.equal(options.method, 'PATCH');
  for (const row of matches) rows.set(row.token_hash, structuredClone(data));
  return json(matches.map(() => data));
};
const request = (path = '', method = 'GET', value, cookie = '', headers = {}) => new Request(origin + '/api/client-profile' + path, {
  method, headers: { origin, cookie, 'content-type': 'application/json', ...headers }, ...(value === undefined ? {} : { body: JSON.stringify(value) }),
});
const run = (...args) => handleClientProfile(request(...args), environment);
try {
  assert.equal(profileConfiguration({ ...environment, AOC_CLIENT_PROFILES_ENABLED: 'false' }).enabled, false);
  assert.equal(profileConfiguration({ ...environment, AOC_INTAKE_ONLY_ENABLED: 'false' }).enabled, false);
  let response = await handleClientProfile(request('/status'), { ...environment, AOC_CLIENT_PROFILES_ENABLED: 'false' });
  assert.equal((await response.json()).available, false); assert.equal(calls, 0);
  response = await run('/status'); assert.deepEqual(await response.json(), { available: true, saved: false, revision: null, retentionDays: 30 });
  assert.equal(response.headers.get('set-cookie'), null); assert.equal(rows.size, 0);
  for (const consent of [false, undefined, 'true']) assert.equal((await run('', 'POST', { ...body, consent })).status, 400);
  assert.equal((await run('', 'POST', body, '', { origin: 'https://other.invalid' })).status, 403);
  assert.equal((await run('?businessEmail=profiles@example.com')).status, 400);
  assert.equal((await run('', 'POST', { ...body, facts: { implementation_fee: { value: '1' } }, area: 'area0' })).status, 400);
  response = await run('', 'POST', body); assert.equal(response.status, 200);
  const cookie = response.headers.get('set-cookie').split(';')[0];
  assert.match(response.headers.get('set-cookie'), /^__Host-aoc_client_profile=[a-f0-9]{64}; Path=\/; HttpOnly; SameSite=Strict; Max-Age=2592000; Secure$/);
  assert.equal(rows.size, 1);
  const token = cookie.split('=')[1], hash = createHash('sha256').update(token).digest('hex');
  assert.ok(rows.has(hash)); assert.ok(!JSON.stringify([...rows.values()]).includes(token));
  let revision = (await response.json()).revision;
  const firstRevision = revision;
  response = await run('', 'GET', undefined, cookie); assert.equal((await response.json()).profile.company, profile.company);
  response = await run('/status', 'GET', undefined, cookie); const status = await response.json();
  assert.deepEqual(status, { available: true, saved: true, revision, retentionDays: 30 });
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal((await run('', 'GET')).status, 404);
  assert.equal((await run('', 'GET', undefined, '__Host-aoc_client_profile=' + 'f'.repeat(64))).status, 404);
  assert.equal((await run('', 'GET', undefined, cookie, { 'sec-fetch-site': 'cross-site' })).status, 403);
  failWrites = true;
  response = await run('', 'POST', { ...body, expectedRevision: revision }, cookie);
  assert.equal(response.status, 503); assert.ok(!(await response.text()).includes('sensitive'));
  failWrites = false;
  const description = 'We use Wave for billing.';
  response = await run('', 'POST', { ...body, expectedRevision: revision, area: 'area0', description,
    facts: { systems: { value: ['Wave'], source: { kind: 'ai_extracted', quote: 'Wave' } } } }, cookie);
  assert.equal(response.status, 200); revision = (await response.json()).revision;
  assert.equal(response.headers.get('set-cookie').split(';')[0], cookie, 'an interrupted response cannot lose the private credential on update');
  assert.equal((await run('', 'POST', { ...body, expectedRevision: firstRevision }, cookie)).status, 409);
  assert.equal((await run('', 'POST', { ...body, expectedRevision: revision, profile: { ...profile, company: 'Another client' } }, cookie)).status, 409);
  const races = await Promise.all(['Role A','Role B'].map(role => run('', 'POST', { ...body, expectedRevision: revision, profile: { ...profile, role } }, cookie)));
  assert.deepEqual(races.map(r=>r.status).sort(), [200,409], 'database CAS rejects an update that became stale after its read');
  response = await run('', 'GET', undefined, cookie); let snapshot = await response.json(); revision = snapshot.revision;
  assert.equal(snapshot.facts.systems.source.kind, 'ai_extracted'); assert.equal(snapshot.facts.systems.source.quote, 'Wave');
  assert.equal((await run('', 'DELETE', undefined, cookie, { 'if-match': firstRevision })).status, 409);
  response = await run('', 'POST', { ...body, profile: snapshot.profile, expectedRevision: revision, facts: {}, removeIds: ['systems'] }, cookie);
  assert.equal(response.status, 200); revision = (await response.json()).revision;
  snapshot = await (await run('', 'GET', undefined, cookie)).json(); assert.deepEqual(snapshot.facts, {});
  response = await run('', 'DELETE', undefined, cookie, { 'if-match': revision }); assert.equal(response.status, 200);
  assert.match(response.headers.get('set-cookie'), /Max-Age=0/); assert.equal(rows.size, 0);
  const stream = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('x'.repeat(40001))); controller.close(); } });
  response = await handleClientProfile(new Request(origin + '/api/client-profile', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: stream, duplex: 'half' }), environment);
  assert.equal(response.status, 413);
  response = await run('', 'POST', body); const expiredCookie = response.headers.get('set-cookie').split(';')[0];
  rows.values().next().value.expires_at = new Date(Date.now()-1).toISOString();
  assert.equal((await (await run('/status', 'GET', undefined, expiredCookie)).json()).saved, false); assert.equal(rows.size, 0);
  assert.equal((await handleProfileCleanup(request('/cleanup'), environment)).status, 401);
  response = await handleProfileCleanup(request('/cleanup', 'GET', undefined, '', { authorization: 'Bearer ' + environment.CRON_SECRET }), environment);
  assert.equal(response.status, 200);
  assert.equal((await handleProfileCleanup(request('/cleanup', 'GET', undefined, '', { authorization: 'Bearer ' + environment.CRON_SECRET }),
    { ...environment, AOC_CLIENT_PROFILES_ENABLED: 'false' })).status, 200, 'expiry cleanup continues when new profile saving is disabled');
  const legacyCalls = [];
  const legacy = createSupabaseProfileStore({url:environment.SUPABASE_URL,key:'legacy-server-key'}, async (url, options) => {
    legacyCalls.push(options);return Response.json([]);
  });
  await legacy.find(hash,Date.now()); assert.equal(legacyCalls[0].headers.Authorization,'Bearer legacy-server-key');
  console.log('PASS: Production Supabase profile protocol, HTTPS host-only cookie, explicit consent, private ownership, source protection, actual CAS races, expiry, cleanup authorization, bounded requests and no credential/PII leakage.');
} finally { globalThis.fetch = originalFetch; }
