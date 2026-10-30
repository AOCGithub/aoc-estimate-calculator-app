// Run with server credentials injected by `vercel env run`, never copied into code.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import postgres from 'postgres';
import AccessRequests from '../server/access-requests.cjs';

const command = process.argv[2] || 'check';
if (!['check', 'setup', 'test'].includes(command)) throw new Error('Use check, setup or test.');
const connection = process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING;
if (!connection) throw new Error('Server-side PostgreSQL configuration is missing.');
const sql = postgres(connection, { prepare: false, max: 1, connect_timeout: 15, idle_timeout: 5, ssl: 'require' });

async function verifySecurity() {
  const [table] = await sql`select relrowsecurity from pg_class where oid = 'public.access_requests'::regclass`;
  assert.equal(table.relrowsecurity, true, 'Row-level security must be enabled.');
  for (const role of ['anon', 'authenticated']) {
    for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) {
      const [grant] = await sql`select has_table_privilege(${role}, 'public.access_requests', ${privilege}) as allowed`;
      assert.equal(grant.allowed, false, `${role} must not have ${privilege} access.`);
    }
  }
  const [service] = await sql`select
    has_table_privilege('service_role', 'public.access_requests', 'INSERT') as can_insert,
    has_table_privilege('service_role', 'public.access_requests', 'UPDATE,DELETE') as can_manage`;
  assert.equal(service.can_insert, true);
  assert.equal(service.can_manage, false);
  const policies = await sql`select policyname from pg_policies where schemaname = 'public' and tablename = 'access_requests'`;
  assert.equal(policies.length, 0, 'No public policies may expose access requests.');
  console.log('PASS: RLS enabled; no public access; application key cannot edit or approve requests.');
}

try {
  const tables = await sql`select tablename from pg_tables where schemaname = 'public' order by tablename`;
  console.log(JSON.stringify({ connected: true, publicTables: tables.map(table => table.tablename) }));
  const exists = tables.some(table => table.tablename === 'access_requests');
  if (command === 'setup' && !exists) {
    const migration = await readFile(new URL('../supabase/migrations/20261029014930_access_requests.sql', import.meta.url), 'utf8');
    await sql.begin(transaction => transaction.unsafe(migration));
    console.log('Created private access_requests table.');
  }
  if (exists || command === 'setup' || command === 'test') await verifySecurity();
  if (command === 'test') {
    const email = 'access-test-' + randomUUID() + '@example.com';
    const configuration = AccessRequests.configuration({ ...process.env, AOC_ACCESS_REQUESTS_ENABLED: 'true' });
    assert.equal(configuration.configured, true);
    const profile = { name: 'Synthetic Test', company: 'AOC Test Only', website: 'https://example.com/', role: 'Testing', businessEmail: email };
    try {
      await AccessRequests.save(configuration, profile);
      const rows = await sql`select name, company, website, role, business_email, review_status from public.access_requests where business_email = ${email}`;
      assert.deepEqual(rows.map(row => ({ ...row })), [{ name: profile.name, company: profile.company, website: profile.website,
        role: profile.role, business_email: email, review_status: 'pending' }]);
      await AccessRequests.save(configuration, profile);
      const [count] = await sql`select count(*)::int as count from public.access_requests where business_email = ${email}`;
      assert.equal(count.count, 2, 'Submissions must not overwrite another request.');
      const publicKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
      assert.ok(publicKey, 'A public key is needed to verify anonymous denial.');
      const headers = { apikey: publicKey, ...(publicKey.startsWith('sb_publishable_') ? {} : { Authorization: 'Bearer ' + publicKey }) };
      const read = await fetch(configuration.url + '/rest/v1/access_requests?select=id', { headers });
      assert.ok([401, 403].includes(read.status), 'Public keys must not list requests.');
      const write = await fetch(configuration.url + '/rest/v1/access_requests', {
        method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: profile.name, company: profile.company, website: profile.website, role: profile.role, business_email: email }),
      });
      assert.ok([401, 403].includes(write.status), 'Public keys must not insert requests directly.');
      console.log('PASS: Real Supabase round trip, all five fields, pending state, append-only submissions, and anonymous read/write denial.');
    } finally {
      const deleted = await sql`delete from public.access_requests where business_email = ${email} returning id`;
      console.log(`Removed ${deleted.length} synthetic test records; no client records touched.`);
    }
  }
} catch (error) {
  // Avoid printing credentials, connection strings, queries or personal details.
  console.error('Database check failed:', error instanceof assert.AssertionError ? error.message : (error.code || error.name));
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
