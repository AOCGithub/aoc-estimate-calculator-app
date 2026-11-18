import postgres from 'postgres';

export function createHostedHandoffStore(connection) {
  const sql = postgres(connection, {
    prepare: false, max: 1, idle_timeout: 20, connect_timeout: 5, ssl: 'require',
  });

  async function submission(id, db = sql) {
    const [row] = await db`SELECT * FROM g2_sandbox.submissions WHERE id = ${id}`;
    return row;
  }

  async function purchase(id, db = sql) {
    const [row] = await db`SELECT * FROM g2_sandbox.purchases WHERE id = ${id}`;
    return row;
  }

  async function recordOutcome(details, event) {
    const {purchaseId, sessionId, paymentId, outcome, receiptUrl, checkoutState} = details;
    return sql.begin(async db => {
      const initial = await purchase(purchaseId, db);
      if (!initial) throw new Error('checkout_conflict');
      // Lock the submission first, as prepare does. All purchases for that
      // submission share one audit intake, even across function instances.
      const [parent] = await db`SELECT * FROM g2_sandbox.submissions
        WHERE id = ${initial.submission_reference} FOR UPDATE`;
      const [current] = await db`SELECT * FROM g2_sandbox.purchases WHERE id = ${purchaseId} FOR UPDATE`;
      if (current.checkout_reference !== sessionId && (!event || current.checkout_reference)) {
        throw new Error('checkout_conflict');
      }
      if (event) {
        const inserted = await db`INSERT INTO g2_sandbox.stripe_events
          (id, purchase_reference, event_type, object_reference, outcome)
          VALUES (${event.eventId}, ${purchaseId}, ${event.type}, ${event.objectId}, ${outcome})
          ON CONFLICT (id) DO NOTHING RETURNING id`;
        if (!inserted.length) {
          const [previous] = await db`SELECT purchase_reference FROM g2_sandbox.stripe_events WHERE id = ${event.eventId}`;
          if (previous.purchase_reference !== purchaseId) throw new Error('event_conflict');
          return {duplicate: true, purchase: current, submission: parent};
        }
      }
      const [updated] = await db`UPDATE g2_sandbox.purchases SET
        checkout_reference = ${sessionId},
        outcome = CASE WHEN outcome = 'paid' THEN 'paid' ELSE ${outcome} END,
        checkout_state = CASE WHEN outcome = 'paid' THEN checkout_state ELSE ${checkoutState} END,
        payment_reference = COALESCE(${paymentId || null}, payment_reference),
        receipt_url = COALESCE(receipt_url, ${receiptUrl || null}),
        paid_at = CASE WHEN ${outcome} = 'paid' THEN COALESCE(paid_at, now()) ELSE paid_at END,
        updated_at = now()
        WHERE id = ${purchaseId} RETURNING *`;
      if (updated.outcome !== 'paid' || parent.audit_intake_reference) {
        return {duplicate: false, purchase: updated, submission: parent};
      }
      const [paidSubmission] = await db`UPDATE g2_sandbox.submissions SET audit_intake_reference = gen_random_uuid(),
        paid_purchase_reference = ${purchaseId} WHERE id = ${parent.id} RETURNING *`;
      return {duplicate: false, purchase: updated, submission: paidSubmission};
    });
  }

  return {
    purchase, submission,
    async check() {
      await sql`SELECT 1 FROM g2_sandbox.purchases LIMIT 0`;
    },
    async bundle(id, ownerHash) {
      const [pair] = await sql`SELECT row_to_json(p) AS purchase, row_to_json(s) AS submission
        FROM g2_sandbox.purchases p JOIN g2_sandbox.submissions s ON s.id = p.submission_reference
        WHERE p.id = ${id} AND s.owner_hash = ${ownerHash}`;
      return pair ?? null;
    },
    prepare({ownerHash, requestReference, fingerprint, description, snapshot, price, submissionReference}) {
      return sql.begin(async db => {
        let parent;
        if (submissionReference) {
          [parent] = await db`SELECT * FROM g2_sandbox.submissions
            WHERE id = ${submissionReference} AND owner_hash = ${ownerHash} FOR UPDATE`;
          if (!parent) return null;
        } else {
          await db`INSERT INTO g2_sandbox.submissions (owner_hash, request_reference, fingerprint, description, snapshot)
            VALUES (${ownerHash}, ${requestReference}, ${fingerprint}, ${description}, ${db.json(snapshot)})
            ON CONFLICT (owner_hash, request_reference) DO NOTHING`;
          [parent] = await db`SELECT * FROM g2_sandbox.submissions
            WHERE owner_hash = ${ownerHash} AND request_reference = ${requestReference} FOR UPDATE`;
          if (parent.fingerprint !== fingerprint) throw new Error('snapshot_conflict');
        }
        if (parent.paid_purchase_reference) {
          return {submission: parent, purchase: await purchase(parent.paid_purchase_reference, db)};
        }
        const [current] = await db`SELECT * FROM g2_sandbox.purchases WHERE submission_reference = ${parent.id}
          AND (outcome IN ('pending', 'processing', 'paid') OR checkout_state = 'open')
          ORDER BY created_at DESC LIMIT 1`;
        if (current) return {submission: parent, purchase: current};
        const [created] = await db`INSERT INTO g2_sandbox.purchases
          (submission_reference, amount, currency, price_reference, item_name)
          VALUES (${parent.id}, ${price.amount}, ${price.currency}, ${price.id}, ${price.name}) RETURNING *`;
        return {submission: parent, purchase: created};
      });
    },
    async bindCheckout(id, session) {
      const bound = await sql`UPDATE g2_sandbox.purchases SET checkout_reference = ${session.id},
        checkout_url = ${session.url || null}, price_reference = ${session.line_items.data[0].price.id},
        checkout_state = CASE WHEN checkout_state = 'creating' THEN ${session.status || 'open'} ELSE checkout_state END,
        updated_at = now() WHERE id = ${id} AND (checkout_reference IS NULL OR checkout_reference = ${session.id})
        RETURNING id`;
      if (!bound.length) throw new Error('checkout_conflict');
    },
    async closeExpiredCheckout(id) {
      await sql`UPDATE g2_sandbox.purchases SET checkout_state = 'expired', outcome = 'incomplete', updated_at = now()
        WHERE id = ${id} AND outcome <> 'paid'`;
    },
    async setReceipt(id, url) {
      await sql`UPDATE g2_sandbox.purchases SET receipt_url = ${url} WHERE id = ${id} AND outcome = 'paid'`;
    },
    reconcileCheckout: details => recordOutcome(details),
    applyEvent: event => recordOutcome(event, event),
    close: () => sql.end({timeout: 5}),
  };
}
