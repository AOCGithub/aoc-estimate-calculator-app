CREATE TABLE g2_sandbox.payment_emails (
  purchase_reference uuid NOT NULL REFERENCES g2_sandbox.purchases(id) ON DELETE RESTRICT,
  audience text NOT NULL CHECK (audience IN ('client', 'support')),
  state text NOT NULL CHECK (state IN ('sending', 'sent', 'retry', 'failed', 'uncertain')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (purchase_reference, audience)
);

ALTER TABLE g2_sandbox.payment_emails ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON g2_sandbox.payment_emails FROM PUBLIC, anon, authenticated, service_role;
