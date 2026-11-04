// Opt-in: real Supabase profile persistence; synthetic capability-owned rows only.
import assert from 'node:assert/strict';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import postgres from 'postgres';
import { handleClientProfile } from '../server/client-profiles.mjs';
assert.ok(process.argv.includes('--database'), 'Explicit --database required.');
const environment = { ...process.env, AOC_CLIENT_PROFILES_ENABLED: 'true', AOC_ACCESS_GATE_ENABLED: 'true', AOC_INTAKE_ONLY_ENABLED: 'true' };
const sql = postgres(process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING, { prepare: false, max: 1, ssl: 'require', connect_timeout: 15 });
const origin = 'https://profile-test.example.invalid';
const ownedHashes = new Set();
const profile = { name: 'Synthetic Profile Database Test', company: 'Profile Integration ' + randomUUID(), website: 'example.com', role: 'Testing', businessEmail: 'profile-database@example.com' };
const base = { profile, consent: true, confirmed: true };
const digest = value => createHash('sha256').update(value).digest('hex');
const run = (method, body, cookie = '', suffix = '', headers = {}) => handleClientProfile(new Request(origin + '/api/client-profile' + suffix, {
  method, headers: { origin, cookie, 'content-type': 'application/json', ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
}), environment);
async function create() {
  const response = await run('POST', base); assert.equal(response.status, 200);
  const cookie = response.headers.get('set-cookie').split(';')[0];
  const hash = digest(cookie.split('=')[1]); ownedHashes.add(hash);
  return { cookie, hash, revision: (await response.json()).revision };
}
try {
  assert.equal((await run('POST', { ...base, consent: false })).status, 400);
  const a = await create(), b = await create();
  assert.notEqual(a.hash, b.hash, 'same email in a different browser cannot retrieve another profile');
  const [stored] = await sql`select details,facts,field_sources,consent_version,confirmed_at,expires_at,token_hash from public.client_profiles where token_hash=${a.hash}`;
  assert.equal(stored.details.company, profile.company); assert.equal(stored.token_hash, a.hash);
  assert.equal(stored.consent_version, 'client-profile-v3');
  assert.equal(new Date(stored.expires_at)-new Date(stored.confirmed_at), 30*86400000);
  assert.ok(!JSON.stringify(stored).includes(a.cookie.split('=')[1]));
  assert.equal((await run('GET', undefined)).status, 404);
  assert.equal((await run('GET', undefined, '', '?businessEmail=' + profile.businessEmail)).status, 400);
  const description='We use Wave and keep information in shared files.';
  let response = await run('POST', { ...base, expectedRevision: a.revision, area:'area0', description,
    facts: { systems:{value:['Wave'],source:{kind:'ai_extracted',quote:'Wave'}},data_information_location:{value:'Shared files',source:{kind:'client_entry'}} } }, a.cookie);
  assert.equal(response.status,200); let revision=(await response.json()).revision;
  const race=await Promise.all(['Synthetic role A','Synthetic role B'].map(role=>run('POST',{...base,expectedRevision:revision,profile:{...profile,role}},a.cookie)));
  assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);
  let snapshot=await (await run('GET',undefined,a.cookie)).json();revision=snapshot.revision;
  assert.equal(snapshot.facts.systems.source.quote,'Wave');assert.equal(snapshot.facts.data_information_location.value,'Shared files');
  assert.equal((await run('DELETE',undefined,a.cookie,'',{'if-match':a.revision})).status,409);
  response=await run('POST',{...base,profile:snapshot.profile,expectedRevision:revision,facts:{},removeIds:['systems']},a.cookie);
  assert.equal(response.status,200);revision=(await response.json()).revision;
  snapshot=await (await run('GET',undefined,a.cookie)).json();assert.equal(snapshot.facts.systems,undefined);assert.ok(snapshot.facts.data_information_location);
  assert.equal((await run('DELETE',undefined,a.cookie,'',{'if-match':revision})).status,200);
  assert.equal((await sql`select id from public.client_profiles where token_hash=${a.hash}`).length,0);
  assert.equal((await run('GET',undefined,b.cookie)).status,200,'deleting A preserves B');
  await sql`update public.client_profiles set confirmed_at=now()-interval '2 days',expires_at=now()-interval '1 day' where token_hash=${b.hash}`;
  assert.equal((await (await run('GET',undefined,b.cookie,'/status')).json()).saved,false);
  assert.equal((await sql`select id from public.client_profiles where token_hash=${b.hash}`).length,0);
  // Execute the database cleanup function inside a rolled-back transaction.
  // Other expired rows, if any, are never permanently modified by this test.
  const hash=digest(randomBytes(32).toString('hex')),id=randomUUID();
  await sql.begin(async tx=>{
    await tx`insert into public.client_profiles(id,token_hash,details,facts,field_sources,consent_version,confirmed_at,expires_at)
      values(${id},${hash},${tx.json(profile)},'{}','{}','synthetic-cleanup-test',now()-interval '2 days',now()-interval '1 day')`;
    await tx`select public.purge_expired_client_profiles()`;
    assert.equal((await tx`select id from public.client_profiles where id=${id}`).length,0);
    throw new Error('ROLLBACK_SYNTHETIC_CLEANUP');
  }).catch(error=>{if(error.message!=='ROLLBACK_SYNTHETIC_CLEANUP')throw error;});
  console.log('PASS: Real Supabase consent-only persistence, hashed browser ownership, separate same-email profiles, provenance, concurrent-update rejection, selective removal, deletion, expiry and rolled-back cleanup.');
} finally {
  for(const hash of ownedHashes) await sql`delete from public.client_profiles where token_hash=${hash}`;
  await sql.end({timeout:5});
  console.log('Removed only this test’s synthetic profiles.');
}
