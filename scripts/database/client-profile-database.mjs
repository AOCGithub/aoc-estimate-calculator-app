import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import postgres from 'postgres';
const command = process.argv[2] || 'check';
assert.ok(['check', 'setup'].includes(command));
const connection = process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING;
assert.ok(connection, 'Run through Vercel env run for server database credentials.');
const sql = postgres(connection, { prepare: false, max: 1, connect_timeout: 15, ssl: 'require' });
try {
  const [existing] = await sql`select to_regclass('public.client_profiles') is not null as exists`;
  if (command === 'setup' && !existing.exists) {
    const migration = await readFile(new URL('../../supabase/migrations/20261104000100_client_profiles.sql', import.meta.url), 'utf8');
    await sql.begin(transaction => transaction.unsafe(migration));
    console.log('Created private optional-profile table and expiry function. Existing submissions and estimates preserved.');
  }
  const [table] = await sql`select relrowsecurity from pg_class where oid = 'public.client_profiles'::regclass`;
  assert.equal(table.relrowsecurity, true);
  for (const role of ['anon', 'authenticated', 'service_role']) for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) {
    const [grant] = await sql`select has_table_privilege(${role}, 'public.client_profiles', ${privilege}) as allowed`;
    assert.equal(grant.allowed, role === 'service_role' && ['SELECT','INSERT','UPDATE','DELETE'].includes(privilege), role + ' ' + privilege);
  }
  assert.equal((await sql`select policyname from pg_policies where schemaname='public' and tablename='client_profiles'`).length, 0);
  for (const role of ['anon','authenticated','service_role']) {
    const [grant] = await sql`select has_function_privilege(${role}, 'public.purge_expired_client_profiles()', 'EXECUTE') as allowed`;
    assert.equal(grant.allowed, role === 'service_role', role + ' cleanup');
  }
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  assert.ok(key, 'Public key is needed to verify anonymous denial.');
  const headers = { apikey: key, ...(key.startsWith('sb_publishable_') ? {} : { Authorization: 'Bearer ' + key }) };
  for (const [path, method] of [['client_profiles?select=id','GET'],['client_profiles','POST'],['rpc/purge_expired_client_profiles','POST']]) {
    const response = await fetch(process.env.SUPABASE_URL + '/rest/v1/' + path, { method, headers: { ...headers, 'Content-Type': 'application/json' },
      ...(method === 'POST' ? { body: '{}' } : {}), signal: AbortSignal.timeout(8000) });
    assert.ok([401,403,404].includes(response.status), 'Public API must deny ' + method + ' ' + path);
  }
  console.log('PASS: Profile RLS, server-only CRUD, no browser policies, private expiry function and anonymous denial.');
} catch (error) {
  console.error('Profile database check failed:', error instanceof assert.AssertionError ? error.message : (error.code || error.name));
  process.exitCode = 1;
} finally { await sql.end({ timeout: 5 }); }
