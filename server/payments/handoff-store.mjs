import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

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
      price_reference TEXT NOT NULL, item_name TEXT NOT NULL,
      checkout_reference TEXT UNIQUE, payment_reference TEXT,
      checkout_url TEXT, checkout_state TEXT NOT NULL DEFAULT 'creating',
      outcome TEXT NOT NULL DEFAULT 'pending' CHECK(outcome IN ('pending','processing','paid','failed','incomplete')),
      receipt_url TEXT, paid_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS g2_one_pending_purchase
      ON g2_purchases(submission_reference) WHERE outcome IN ('pending','processing');
    CREATE TABLE IF NOT EXISTS g2_stripe_events (
      id TEXT PRIMARY KEY, purchase_reference TEXT NOT NULL REFERENCES g2_purchases(id) ON DELETE RESTRICT,
      event_type TEXT NOT NULL, object_reference TEXT NOT NULL, outcome TEXT NOT NULL, processed_at TEXT NOT NULL
    );
    CREATE VIEW IF NOT EXISTS g2_audit_intakes AS SELECT s.audit_intake_reference AS id,
      s.id AS submission_reference,s.recording_reference,s.paid_purchase_reference AS purchase_reference,
      p.paid_at AS created_at FROM g2_submissions s JOIN g2_purchases p ON p.id=s.paid_purchase_reference
      WHERE s.audit_intake_reference IS NOT NULL;`);

  function transaction(run) {
    db.exec('BEGIN IMMEDIATE');
    try { const result = run(); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  function submission(id) { return db.prepare('SELECT * FROM g2_submissions WHERE id=?').get(id); }
  function purchase(id) { return db.prepare('SELECT * FROM g2_purchases WHERE id=?').get(id); }
  function bundle(id, ownerHash) {
    const row = purchase(id);
    if (!row) return null;
    const parent = submission(row.submission_reference);
    if (!parent || parent.owner_hash !== ownerHash) return null;
    return { purchase: row, submission: parent };
  }
  function newPurchase(parent, price) {
    const id = randomUUID(), now = new Date().toISOString();
    db.prepare(`INSERT INTO g2_purchases(id,submission_reference,amount,currency,price_reference,item_name,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?)`).run(id,parent.id,price.amount,price.currency,price.id,price.name,now,now);
    return { purchase: purchase(id), submission: parent };
  }
  return {
    prepare({ ownerHash, requestReference, fingerprint, description, snapshot, price, submissionReference }) {
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
        if (existing) return { submission: parent, purchase: existing };
        if (parent.paid_purchase_reference) return { submission: parent, purchase: purchase(parent.paid_purchase_reference) };
        return newPurchase(parent,price);
      });
    },
    bundle, purchase, submission,
    bindCheckout(id, session) {
      const current = purchase(id);
      if (!current || (current.checkout_reference && current.checkout_reference !== session.id)) throw new Error('checkout_conflict');
      db.prepare(`UPDATE g2_purchases SET checkout_reference=?,checkout_url=?,checkout_state=?,updated_at=? WHERE id=?`)
        .run(session.id,session.url || null,session.status || 'open',new Date().toISOString(),id);
    },
    closeExpiredCheckout(id) {
      db.prepare(`UPDATE g2_purchases SET checkout_state='expired',outcome=CASE WHEN outcome='paid' THEN 'paid' ELSE 'incomplete' END,updated_at=? WHERE id=?`)
        .run(new Date().toISOString(),id);
    },
    setReceipt(id,url) {
      db.prepare("UPDATE g2_purchases SET receipt_url=? WHERE id=? AND outcome='paid'").run(url,id);
    },
    applyEvent({ eventId, type, objectId, purchaseId, sessionId, paymentId, outcome, receiptUrl, checkoutState }) {
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
        const finalOutcome = current.outcome === 'paid' ? 'paid' : outcome;
        db.prepare(`UPDATE g2_purchases SET outcome=?,checkout_reference=?,payment_reference=COALESCE(?,payment_reference),
          receipt_url=COALESCE(?,receipt_url),checkout_state=?,updated_at=?,paid_at=COALESCE(paid_at,?) WHERE id=?`)
          .run(finalOutcome,sessionId,paymentId || null,receiptUrl || null,checkoutState,new Date().toISOString(),
            finalOutcome==='paid'?new Date().toISOString():null,purchaseId);
        if (finalOutcome === 'paid') {
          db.prepare(`UPDATE g2_submissions SET audit_intake_reference=COALESCE(audit_intake_reference,?),
            paid_purchase_reference=COALESCE(paid_purchase_reference,?) WHERE id=?`)
            .run(randomUUID(),purchaseId,current.submission_reference);
        }
        return { duplicate: false, purchase: purchase(purchaseId), submission: submission(current.submission_reference) };
      });
    },
    counts: () => ({
      submissions: db.prepare('SELECT count(*) AS n FROM g2_submissions').get().n,
      purchases: db.prepare('SELECT count(*) AS n FROM g2_purchases').get().n,
      events: db.prepare('SELECT count(*) AS n FROM g2_stripe_events').get().n,
      auditIntakes: db.prepare('SELECT count(*) AS n FROM g2_audit_intakes').get().n,
    }),
    close: () => db.close(),
  };
}
