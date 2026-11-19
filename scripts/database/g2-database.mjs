import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import postgres from 'postgres';
import { createHostedHandoffStore } from '../../server/payments/hosted-handoff-store.mjs';

const command = process.argv[2] || 'check';
assert.ok(['setup', 'check', 'test'].includes(command), 'Use setup, check or test.');
const connection = process.env.AOC_G2_POSTGRES_URL || process.env.POSTGRES_URL;
assert.ok(connection, 'Load the server database connection through Vercel env run.');
const sql = postgres(connection, {prepare: false, max: 1, connect_timeout: 10, ssl: 'require'});

try {
  if (command === 'setup') {
    const migrations = await Promise.all([
      new URL('../../supabase/migrations/20261118000100_g2_sandbox.sql', import.meta.url),
      new URL('../../supabase/migrations/20261119000100_g2_payment_emails.sql', import.meta.url),
    ].map(file => readFile(file, 'utf8')));
    await sql.begin(async db => {
      await db`SELECT pg_advisory_xact_lock(20261118, 2)`;
      const [existing] = await db`SELECT to_regnamespace('g2_sandbox') IS NOT NULL AS present`;
      if (!existing.present) await db.unsafe(migrations[0]);
      const [email] = await db`SELECT to_regclass('g2_sandbox.payment_emails') IS NOT NULL AS present`;
      if (!email.present) await db.unsafe(migrations[1]);
    });
  }
  const tables = await sql`SELECT c.relname, c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'g2_sandbox' AND c.relkind = 'r' ORDER BY c.relname`;
  assert.deepEqual(tables.map(row => row.relname), ['payment_emails', 'purchases', 'stripe_events', 'submissions']);
  assert.ok(tables.every(row => row.relrowsecurity));
  for (const role of ['anon', 'authenticated', 'service_role']) {
    const [permissions] = await sql`SELECT has_schema_privilege(${role}, 'g2_sandbox', 'usage,create') AS allowed`;
    assert.equal(permissions.allowed, false, `${role} cannot access G2 data`);
    for (const table of [...tables.map(row => row.relname), 'audit_intakes']) {
      const [grant] = await sql`SELECT has_table_privilege(${role}, ${'g2_sandbox.' + table},
        'select,insert,update,delete,truncate,references,trigger') AS allowed`;
      assert.equal(grant.allowed, false, `${role} has no G2 table grants`);
    }
  }
  console.log('PASS: G2 sandbox uses its own private schema and has no browser/API grants.');
  if (command === 'test') await verifyTransactions();
} catch (error) {
  console.error('G2 database check failed:', error instanceof assert.AssertionError ? error.message : (error.code || error.name));
  process.exitCode = 1;
} finally {
  await sql.end({timeout: 5});
}

async function verifyTransactions() {
  const first = createHostedHandoffStore(connection);
  const second = createHostedHandoffStore(connection);
  const ownerHash = `g2-fixture-${randomUUID()}`;
  const order = {ownerHash, requestReference: randomUUID(), description: 'Synthetic G2 database check',
    fingerprint: 'fixture', snapshot: {result: {audit: 1250}},
    price: {id: 'inline_audit_quote', name: 'Initial audit', amount: 125000, currency: 'usd'}};
  const sessionId = () => `cs_test_fixture_${randomUUID()}`;
  const session = id => ({id, status: 'open', line_items: {data: [{price: {id: 'price_fixture'}}]}});
  try {
    const [left, right] = await Promise.all([first.prepare(order), second.prepare(order)]);
    const purchaseId = left.purchase.id;
    assert.equal(right.purchase.id, purchaseId);
    await assert.rejects(second.prepare({...order, fingerprint: 'changed'}), /snapshot_conflict/);
    assert.equal(await second.bundle(purchaseId, 'another-owner'), null);
    const different = await second.prepare({...order, requestReference: randomUUID()});
    assert.notEqual(left.submission.id, different.submission.id);
    assert.notEqual(left.submission.recording_reference, different.submission.recording_reference);

    const primarySession = sessionId();
    await first.bindCheckout(purchaseId, session(primarySession));
    const event = {eventId: `evt_fixture_${randomUUID()}`, purchaseId, sessionId: primarySession,
      type: 'checkout.session.completed', objectId: primarySession, outcome: 'paid', checkoutState: 'complete',
      paymentId: 'pi_fixture', receiptUrl: 'https://pay.stripe.com/receipts/payment/fixture'};
    const replay = await Promise.all([first.applyEvent(event), second.applyEvent(event)]);
    assert.equal(replay.filter(result => result.duplicate).length, 1);
    assert.ok(replay[0].submission.audit_intake_reference);
    assert.equal(replay[0].submission.audit_intake_reference, replay[1].submission.audit_intake_reference);
    assert.equal((await second.bundle(purchaseId, ownerHash)).purchase.receipt_url, event.receiptUrl);
    assert.equal((await second.prepare(order)).purchase.id, purchaseId);
    const mailClaims = await Promise.all([first.claimPaymentEmail(purchaseId, 'client'), second.claimPaymentEmail(purchaseId, 'client')]);
    assert.equal(mailClaims.filter(Boolean).length, 1);
    await first.finishPaymentEmail(purchaseId, 'client', 'sent');
    assert.equal(await second.claimPaymentEmail(purchaseId, 'client'), false);
    assert.equal(await second.claimPaymentEmail(purchaseId, 'support'), true);
    await second.finishPaymentEmail(purchaseId, 'support', 'retry');
    assert.equal(await first.claimPaymentEmail(purchaseId, 'support'), true);
    assert.equal(await first.claimPaymentEmail(different.purchase.id, 'client'), false);

    const unpaidSession = sessionId();
    await first.bindCheckout(different.purchase.id, session(unpaidSession));
    const unpaid = {purchaseId: different.purchase.id, sessionId: unpaidSession};
    const failed = await first.reconcileCheckout({...unpaid, outcome: 'failed', checkoutState: 'open'});
    assert.equal(failed.purchase.outcome, 'failed');
    assert.equal(failed.submission.audit_intake_reference, null);
    const expired = await second.reconcileCheckout({...unpaid, outcome: 'incomplete', checkoutState: 'expired'});
    assert.equal(expired.purchase.outcome, 'incomplete');
    assert.equal(expired.submission.audit_intake_reference, null);
    const replacement = await second.prepare({...order, submissionReference: different.submission.id});
    assert.notEqual(replacement.purchase.id, different.purchase.id);
    const [intakes] = await sql`SELECT count(*)::integer AS total FROM g2_sandbox.audit_intakes i
      JOIN g2_sandbox.submissions s ON s.id = i.submission_reference WHERE s.owner_hash = ${ownerHash}`;
    assert.equal(intakes.total, 1);
    console.log('PASS: Concurrent payments and event replay, exact estimate ownership, receipt, failed and expired outcomes.');
  } finally {
    await Promise.all([first.close(), second.close()]);
    // Remove only this run's synthetic fixtures.
    await sql.begin(async db => {
      await db`DELETE FROM g2_sandbox.payment_emails e USING g2_sandbox.purchases p, g2_sandbox.submissions s
        WHERE e.purchase_reference = p.id AND p.submission_reference = s.id AND s.owner_hash = ${ownerHash}`;
      await db`DELETE FROM g2_sandbox.stripe_events e USING g2_sandbox.purchases p, g2_sandbox.submissions s
        WHERE e.purchase_reference = p.id AND p.submission_reference = s.id AND s.owner_hash = ${ownerHash}`;
      await db`UPDATE g2_sandbox.submissions SET paid_purchase_reference = NULL, audit_intake_reference = NULL WHERE owner_hash = ${ownerHash}`;
      await db`DELETE FROM g2_sandbox.purchases p USING g2_sandbox.submissions s
        WHERE p.submission_reference = s.id AND s.owner_hash = ${ownerHash}`;
      await db`DELETE FROM g2_sandbox.submissions WHERE owner_hash = ${ownerHash}`;
    });
  }
}
