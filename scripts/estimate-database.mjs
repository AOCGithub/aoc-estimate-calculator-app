import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import postgres from 'postgres';

const command = process.argv[2] || 'check';
if (!['check', 'setup'].includes(command)) throw new Error('Use check or setup.');
const connection = process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING;
if (!connection) throw new Error('Run through Vercel env run for database credentials.');
const sql = postgres(connection, { prepare: false, max: 1, connect_timeout: 15, ssl: 'require' });
try {
  const [existing] = await sql`select to_regclass('public.estimates') is not null as exists`;
  if (command === 'setup' && !existing.exists) {
    const migration = await readFile(new URL('../supabase/migrations/20261029073549_estimate_records.sql', import.meta.url), 'utf8');
    await sql.begin(transaction => transaction.unsafe(migration));
    console.log('Created estimates table and submission foreign key. Existing records preserved.');
  }
  const [table] = await sql`select relrowsecurity from pg_class where oid = 'public.estimates'::regclass`;
  assert.equal(table.relrowsecurity, true);
  for (const role of ['anon', 'authenticated', 'service_role']) {
    for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) {
      const [grant] = await sql`select has_table_privilege(${role}, 'public.estimates', ${privilege}) as allowed`;
      assert.equal(grant.allowed, role === 'service_role' && privilege === 'INSERT', `${role} ${privilege}`);
    }
  }
  const policies = await sql`select policyname from pg_policies where schemaname = 'public' and tablename = 'estimates'`;
  assert.equal(policies.length, 0);
  const fks = await sql`select confdeltype from pg_constraint where conrelid = 'public.estimates'::regclass
    and confrelid = 'public.access_requests'::regclass and contype = 'f'`;
  assert.equal(fks.length, 1);
  assert.equal(fks[0].confdeltype, 'r', 'Deleting a submission must not silently erase its estimates.');
  const indexes = await sql`select indexname from pg_indexes where schemaname = 'public' and tablename = 'estimates'`;
  assert.ok(indexes.some(row => row.indexname === 'estimates_request_created_idx'));
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  assert.ok(key, 'Public key required to check anonymous denial.');
  const headers = { apikey: key, ...(key.startsWith('sb_publishable_') ? {} : { Authorization: 'Bearer ' + key }) };
  const read = await fetch(process.env.SUPABASE_URL + '/rest/v1/estimates?select=id', { headers, signal: AbortSignal.timeout(8000) });
  assert.ok([401, 403].includes(read.status), 'Anonymous keys must not read estimates.');
  const write = await fetch(process.env.SUPABASE_URL + '/rest/v1/estimates', {
    method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(8000),
  });
  assert.ok([401, 403].includes(write.status), 'Anonymous keys must not write estimates.');
  console.log('PASS: Linked estimates, indexed owner/date, RLS, no browser grants/policies, insert-only server grants, restricted deletion.');
} catch (error) {
  console.error('Estimate database check failed:', error instanceof assert.AssertionError ? error.message : (error.code || error.name));
  process.exitCode = 1;
} finally { await sql.end({ timeout: 5 }); }
