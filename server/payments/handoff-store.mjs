import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { sameC10Order } from './c10-order.mjs';

// Local G2 rehearsal data only. This adapter is never enabled on Vercel.
export function createHandoffStore(filename) {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS g2_submissions (
      id TEXT PRIMARY KEY, recording_reference TEXT NOT NULL UNIQUE,
      owner_hash TEXT NOT NULL, request_reference TEXT NOT NULL, fingerprint TEXT NOT NULL,
      description TEXT NOT NULL, snapshot TEXT NOT NULL CHECK(json_valid(snapshot)),
      audit_intake_reference TEXT UNIQUE, paid_purchase_reference TEXT REFERENCES g2_purchases(id) ON DELETE RESTRICT,
      created_at TEXT NOT NULL, UNIQUE(owner_hash,request_reference)
    );
    CREATE TABLE IF NOT EXISTS g2_purchases (
      id TEXT PRIMARY KEY, submission_reference TEXT NOT NULL REFERENCES g2_submissions(id) ON DELETE RESTRICT,
      amount INTEGER NOT NULL CHECK(amount>0), currency TEXT NOT NULL CHECK(currency='usd'),
      price_reference TEXT NOT NULL, quote_reference TEXT, item_name TEXT NOT NULL,
      checkout_reference TEXT UNIQUE, payment_reference TEXT,
      checkout_url TEXT, checkout_state TEXT NOT NULL DEFAULT 'creating',
      outcome TEXT NOT NULL DEFAULT 'pending' CHECK(outcome IN ('pending','processing','paid','failed','incomplete')),
      receipt_url TEXT, paid_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS g2_one_pending_purchase
      ON g2_purchases(submission_reference) WHERE outcome IN ('pending','processing');
    CREATE TABLE IF NOT EXISTS g2_audit_quotes (
      id TEXT PRIMARY KEY, submission_reference TEXT NOT NULL UNIQUE REFERENCES g2_submissions(id) ON DELETE RESTRICT,
      scope_fingerprint TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount>0),
      currency TEXT NOT NULL CHECK(currency='usd'), quoted_by TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'quoted' CHECK(status IN ('quoted','withdrawn')),
      quoted_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS g2_stripe_events (
      id TEXT PRIMARY KEY, purchase_reference TEXT NOT NULL REFERENCES g2_purchases(id) ON DELETE RESTRICT,
      event_type TEXT NOT NULL, object_reference TEXT NOT NULL, outcome TEXT NOT NULL, processed_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS g2_payment_emails (
      purchase_reference TEXT NOT NULL REFERENCES g2_purchases(id) ON DELETE RESTRICT,
      audience TEXT NOT NULL CHECK(audience IN ('client','support')),
      state TEXT NOT NULL CHECK(state IN ('sending','sent','retry','failed','uncertain')),
      updated_at TEXT NOT NULL, PRIMARY KEY(purchase_reference,audience)
    );
    CREATE VIEW IF NOT EXISTS g2_audit_intakes AS SELECT s.audit_intake_reference AS id,
      s.id AS submission_reference,s.recording_reference,s.paid_purchase_reference AS purchase_reference,
      p.paid_at AS created_at FROM g2_submissions s JOIN g2_purchases p ON p.id=s.paid_purchase_reference
      WHERE s.audit_intake_reference IS NOT NULL;`);
  if (!db.prepare("SELECT 1 FROM pragma_table_info('g2_purchases') WHERE name='quote_reference'").get()) {
    db.exec('ALTER TABLE g2_purchases ADD COLUMN quote_reference TEXT REFERENCES g2_audit_quotes(id) ON DELETE RESTRICT');
  }
  if (!db.prepare("SELECT 1 FROM pragma_table_info('g2_purchases') WHERE name='purchase_agreement_version'").get()) {
    db.exec('ALTER TABLE g2_purchases ADD COLUMN purchase_agreement_version TEXT');
  }
  if (!db.prepare("SELECT 1 FROM pragma_table_info('g2_purchases') WHERE name='purchase_agreed_at'").get()) {
    db.exec('ALTER TABLE g2_purchases ADD COLUMN purchase_agreed_at TEXT');
  }
  if (!db.prepare("SELECT 1 FROM pragma_table_info('g2_purchases') WHERE name='accepted_order'").get()) {
    db.exec("ALTER TABLE g2_purchases ADD COLUMN accepted_order TEXT CHECK(accepted_order IS NULL OR json_valid(accepted_order))");
  }

  function transaction(run) {
    db.exec('BEGIN IMMEDIATE');
    try { const result = run(); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  function submission(id) { return db.prepare('SELECT * FROM g2_submissions WHERE id=?').get(id); }
  function purchase(id) { return db.prepare('SELECT * FROM g2_purchases WHERE id=?').get(id); }
  function quote(submissionReference) {
    return db.prepare("SELECT * FROM g2_audit_quotes WHERE submission_reference=? AND status='quoted'").get(submissionReference);
  }
  function bundle(id, ownerHash) {
    const row = purchase(id);
    if (!row) return null;
    const parent = submission(row.submission_reference);
    if (!parent || parent.owner_hash !== ownerHash) return null;
    return { purchase: row, submission: parent };
  }
  function newPurchase(parent, price, agreement, acceptedOrder) {
    const id = randomUUID(), now = new Date().toISOString();
    db.prepare(`INSERT INTO g2_purchases(id,submission_reference,amount,currency,price_reference,quote_reference,item_name,
      purchase_agreement_version,purchase_agreed_at,accepted_order,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id,parent.id,price.amount,price.currency,price.id,price.quoteReference,price.name,
        agreement.version,agreement.acceptedAt,JSON.stringify(acceptedOrder),now,now);
    return { purchase: purchase(id), submission: parent };
  }
  // Both signed webhooks and a server-verified Stripe refresh use the same
  // transaction rules. A refresh is not recorded as a fabricated Stripe event.
  function updateOutcome({purchaseId,sessionId,paymentId,outcome,receiptUrl,checkoutState,paidAt}) {
    const current=purchase(purchaseId);
    if(!current || current.checkout_reference!==sessionId)throw new Error('checkout_conflict');
    const finalOutcome=current.outcome==='paid'?'paid':outcome;
    db.prepare(`UPDATE g2_purchases SET outcome=?,payment_reference=COALESCE(?,payment_reference),
      receipt_url=COALESCE(?,receipt_url),checkout_state=?,updated_at=?,paid_at=COALESCE(paid_at,?) WHERE id=?`)
      .run(finalOutcome,paymentId||null,receiptUrl||null,checkoutState,new Date().toISOString(),
        finalOutcome==='paid'?(paidAt||new Date().toISOString()):null,purchaseId);
    if(finalOutcome==='paid'){
      db.prepare(`UPDATE g2_submissions SET audit_intake_reference=COALESCE(audit_intake_reference,?),
        paid_purchase_reference=COALESCE(paid_purchase_reference,?) WHERE id=?`)
        .run(randomUUID(),purchaseId,current.submission_reference);
    }
    return {purchase:purchase(purchaseId),submission:submission(current.submission_reference)};
  }
  return {
    saveSubmission({ownerHash,requestReference,fingerprint,description,snapshot}) {
      return transaction(() => {
        let parent=db.prepare('SELECT * FROM g2_submissions WHERE owner_hash=? AND request_reference=?').get(ownerHash,requestReference);
        if(parent&&parent.fingerprint!==fingerprint)throw new Error('snapshot_conflict');
        if(!parent){
          const id=randomUUID();
          db.prepare(`INSERT INTO g2_submissions(id,recording_reference,owner_hash,request_reference,fingerprint,description,snapshot,created_at)
            VALUES(?,?,?,?,?,?,?,?)`).run(id,randomUUID(),ownerHash,requestReference,fingerprint,description,JSON.stringify(snapshot),new Date().toISOString());
          parent=submission(id);
        }
        return {submission:parent,quote:quote(parent.id)||null};
      });
    },
    quote,
    approveQuote({submissionReference,amount,currency='usd',quotedBy}) {
      return transaction(() => {
        const parent=submission(submissionReference);
        if(!parent)throw new Error('submission_missing');
        if(db.prepare('SELECT 1 FROM g2_purchases WHERE submission_reference=? LIMIT 1').get(submissionReference))throw new Error('quote_locked');
        const now=new Date().toISOString(),existing=quote(submissionReference),id=existing?.id||randomUUID();
        db.prepare(`INSERT INTO g2_audit_quotes(id,submission_reference,scope_fingerprint,amount,currency,quoted_by,status,quoted_at,updated_at)
          VALUES(?,?,?,?,?,?,'quoted',?,?) ON CONFLICT(submission_reference) DO UPDATE SET
          amount=excluded.amount,currency=excluded.currency,quoted_by=excluded.quoted_by,status='quoted',quoted_at=excluded.quoted_at,updated_at=excluded.updated_at`)
          .run(id,submissionReference,parent.fingerprint,amount,currency,quotedBy,now,now);
        return quote(submissionReference);
      });
    },
    prepare({ ownerHash, requestReference, fingerprint, description, snapshot, price, submissionReference, agreement, acceptedOrder }) {
      return transaction(() => {
        let parent;
        if (submissionReference) {
          parent = submission(submissionReference);
          if (!parent || parent.owner_hash !== ownerHash) return null;
        } else {
          parent = db.prepare('SELECT * FROM g2_submissions WHERE owner_hash=? AND request_reference=?').get(ownerHash,requestReference);
          if (parent && parent.fingerprint !== fingerprint) throw new Error('snapshot_conflict');
          if (!parent) {
            const id = randomUUID();
            db.prepare(`INSERT INTO g2_submissions(id,recording_reference,owner_hash,request_reference,fingerprint,description,snapshot,created_at)
              VALUES(?,?,?,?,?,?,?,?)`).run(id,randomUUID(),ownerHash,requestReference,fingerprint,description,JSON.stringify(snapshot),new Date().toISOString());
            parent = submission(id);
          }
        }
        const existing = db.prepare(`SELECT * FROM g2_purchases WHERE submission_reference=?
          AND (outcome IN ('pending','processing','paid') OR checkout_state='open')
          ORDER BY created_at DESC LIMIT 1`).get(parent.id);
        if (existing) {
          if (existing.purchase_agreement_version && existing.purchase_agreement_version !== agreement.version) {
            throw new Error('agreement_conflict');
          }
          const storedOrder = existing.accepted_order ? JSON.parse(existing.accepted_order) : null;
          if (storedOrder && !sameC10Order(storedOrder, acceptedOrder)) throw new Error('order_conflict');
          if (!existing.purchase_agreement_version || !storedOrder) {
            db.prepare(`UPDATE g2_purchases SET purchase_agreement_version=?,purchase_agreed_at=?,accepted_order=?,updated_at=? WHERE id=?`)
              .run(agreement.version,agreement.acceptedAt,JSON.stringify(acceptedOrder),new Date().toISOString(),existing.id);
          }
          return { submission: parent, purchase: purchase(existing.id) };
        }
        if (parent.paid_purchase_reference) return { submission: parent, purchase: purchase(parent.paid_purchase_reference) };
        return newPurchase(parent,price,agreement,acceptedOrder);
      });
    },
    bundle, purchase, submission,
    bindCheckout(id, session) {
      const current = purchase(id);
      if (!current || (current.checkout_reference && current.checkout_reference !== session.id)) throw new Error('checkout_conflict');
      db.prepare(`UPDATE g2_purchases SET checkout_reference=?,checkout_url=?,checkout_state=?,price_reference=?,updated_at=? WHERE id=?`)
        .run(session.id,session.url || null,session.status || 'open',session.line_items.data[0].price.id,new Date().toISOString(),id);
    },
    closeExpiredCheckout(id) {
      db.prepare(`UPDATE g2_purchases SET checkout_state='expired',outcome=CASE WHEN outcome='paid' THEN 'paid' ELSE 'incomplete' END,updated_at=? WHERE id=?`)
        .run(new Date().toISOString(),id);
    },
    setReceipt(id,url) {
      db.prepare("UPDATE g2_purchases SET receipt_url=? WHERE id=? AND outcome='paid'").run(url,id);
    },
    reconcileCheckout(details) {
      return transaction(()=>updateOutcome(details));
    },
    applyEvent({ eventId, type, objectId, purchaseId, sessionId, paymentId, outcome, receiptUrl, checkoutState, paidAt }) {
      return transaction(() => {
        const current = purchase(purchaseId);
        if (!current || (current.checkout_reference && current.checkout_reference !== sessionId)) throw new Error('checkout_conflict');
        const previous = db.prepare('SELECT purchase_reference FROM g2_stripe_events WHERE id=?').get(eventId);
        if (previous) {
          if (previous.purchase_reference !== purchaseId) throw new Error('event_conflict');
          return { duplicate: true, purchase: current, submission: submission(current.submission_reference) };
        }
        db.prepare(`INSERT INTO g2_stripe_events(id,purchase_reference,event_type,object_reference,outcome,processed_at)
          VALUES(?,?,?,?,?,?)`).run(eventId,purchaseId,type,objectId,outcome,new Date().toISOString());
        // An event can arrive before the checkout creation response is bound.
        if(!current.checkout_reference)db.prepare('UPDATE g2_purchases SET checkout_reference=? WHERE id=?').run(sessionId,purchaseId);
        return {duplicate:false,...updateOutcome({purchaseId,sessionId,paymentId,outcome,receiptUrl,checkoutState,paidAt})};
      });
    },
    claimPaymentEmail(purchaseId,audience) {
      return db.prepare(`INSERT INTO g2_payment_emails(purchase_reference,audience,state,updated_at)
        SELECT id,?,'sending',? FROM g2_purchases WHERE id=? AND outcome='paid'
        ON CONFLICT(purchase_reference,audience) DO UPDATE SET state='sending',updated_at=excluded.updated_at
        WHERE g2_payment_emails.state='retry'`).run(audience,new Date().toISOString(),purchaseId).changes===1;
    },
    finishPaymentEmail(purchaseId,audience,state) {
      db.prepare(`UPDATE g2_payment_emails SET state=?,updated_at=?
        WHERE purchase_reference=? AND audience=? AND state='sending'`).run(state,new Date().toISOString(),purchaseId,audience);
    },
    counts: () => ({
      submissions: db.prepare('SELECT count(*) AS n FROM g2_submissions').get().n,
      quotes: db.prepare('SELECT count(*) AS n FROM g2_audit_quotes').get().n,
      purchases: db.prepare('SELECT count(*) AS n FROM g2_purchases').get().n,
      events: db.prepare('SELECT count(*) AS n FROM g2_stripe_events').get().n,
      auditIntakes: db.prepare('SELECT count(*) AS n FROM g2_audit_intakes').get().n,
    }),
    close: () => db.close(),
  };
}
