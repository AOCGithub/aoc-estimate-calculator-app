-- Stripe sandbox records are isolated from client profiles and saved estimates.
CREATE SCHEMA g2_sandbox;
REVOKE ALL ON SCHEMA g2_sandbox FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE g2_sandbox.submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_reference uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  owner_hash text NOT NULL,
  request_reference uuid NOT NULL,
  fingerprint text NOT NULL,
  description text NOT NULL CHECK (char_length(description) BETWEEN 1 AND 18000),
  snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  audit_intake_reference uuid UNIQUE,
  paid_purchase_reference uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_hash, request_reference)
);

CREATE TABLE g2_sandbox.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_reference uuid NOT NULL REFERENCES g2_sandbox.submissions(id) ON DELETE RESTRICT,
  amount integer NOT NULL CHECK (amount BETWEEN 1 AND 99999999),
  currency text NOT NULL CHECK (currency = 'usd'),
  price_reference text NOT NULL,
  item_name text NOT NULL,
  checkout_reference text UNIQUE,
  payment_reference text,
  checkout_url text,
  checkout_state text NOT NULL DEFAULT 'creating',
  outcome text NOT NULL DEFAULT 'pending' CHECK (outcome IN ('pending', 'processing', 'paid', 'failed', 'incomplete')),
  receipt_url text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (submission_reference, id)
);

ALTER TABLE g2_sandbox.submissions ADD FOREIGN KEY (id, paid_purchase_reference)
  REFERENCES g2_sandbox.purchases(submission_reference, id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX g2_one_pending_purchase ON g2_sandbox.purchases(submission_reference)
  WHERE outcome IN ('pending', 'processing');

CREATE TABLE g2_sandbox.stripe_events (
  id text PRIMARY KEY,
  purchase_reference uuid NOT NULL REFERENCES g2_sandbox.purchases(id) ON DELETE RESTRICT,
  event_type text NOT NULL,
  object_reference text NOT NULL,
  outcome text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);

CREATE VIEW g2_sandbox.audit_intakes WITH (security_invoker = true) AS
SELECT s.audit_intake_reference AS id, s.id AS submission_reference, s.recording_reference,
  s.paid_purchase_reference AS purchase_reference, p.paid_at AS created_at
FROM g2_sandbox.submissions s JOIN g2_sandbox.purchases p ON p.id = s.paid_purchase_reference
WHERE s.audit_intake_reference IS NOT NULL;

ALTER TABLE g2_sandbox.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE g2_sandbox.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE g2_sandbox.stripe_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA g2_sandbox FROM PUBLIC, anon, authenticated, service_role;
