import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import postgres from 'postgres';

const command = process.argv[2] || 'check';
if (!['check', 'setup'].includes(command)) throw new Error('Use check or setup.');
const connection = process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING;
if (!connection) throw new Error('Run through Vercel env run to inject database credentials.');
const sql = postgres(connection, { prepare: false, max: 1, connect_timeout: 15, ssl: 'require' });
try {
  const [existing] = await sql`select to_regclass('public.access_invitations') is not null as exists`;
  if (command === 'setup' && !existing.exists) {
    const migration = await readFile(new URL('../supabase/migrations/20261029033128_manual_access_invitations.sql', import.meta.url), 'utf8');
    await sql.begin(transaction => transaction.unsafe(migration));
    console.log('Added private invitation tables and manual decision options. Existing requests preserved.');
  }
  const tables = await sql`select relname, relrowsecurity from pg_class where oid in
    ('public.access_requests'::regclass, 'public.access_invitations'::regclass)`;
  assert.equal(tables.length, 2);
  assert.ok(tables.every(table => table.relrowsecurity));
  for (const role of ['anon', 'authenticated']) {
    for (const table of ['access_requests', 'access_invitations']) {
      const [privileges] = await sql`select has_table_privilege(${role}, ${'public.' + table}, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') as allowed`;
      assert.equal(privileges.allowed, false, role + ' must not have table access.');
    }
    const [execute] = await sql`select has_function_privilege(${role}, 'public.redeem_access_invitation(text,text,integer)', 'EXECUTE') as allowed`;
    assert.equal(execute.allowed, false, role + ' must not redeem directly.');
  }
  const [invoker] = await sql`select prosecdef from pg_proc where oid = 'public.redeem_access_invitation(text,text,integer)'::regprocedure`;
  assert.equal(invoker.prosecdef, false, 'Redemption must not use SECURITY DEFINER.');
  const [service] = await sql`select
    has_table_privilege('service_role', 'public.access_requests', 'SELECT') as can_review,
    has_table_privilege('service_role', 'public.access_requests', 'UPDATE,DELETE') as can_approve,
    has_table_privilege('service_role', 'public.access_invitations', 'INSERT,DELETE') as can_issue,
    has_column_privilege('service_role', 'public.access_invitations', 'used_at', 'UPDATE') as can_redeem`;
  assert.equal(service.can_review, true);
  assert.equal(service.can_approve, false);
  assert.equal(service.can_issue, false);
  assert.equal(service.can_redeem, true);
  console.log('PASS: Private RLS tables; no public grants or RPC execution; invoker-only atomic redemption; API cannot approve requests or issue links.');
} catch (error) {
  console.error('Manual-access database check failed:', error instanceof assert.AssertionError ? error.message : (error.code || error.name));
  process.exitCode = 1;
} finally { await sql.end({ timeout: 5 }); }
