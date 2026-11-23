-- A payable audit amount must come from an AOC quote tied to the saved scope.
-- The browser cannot create or edit these records.
CREATE TABLE g2_sandbox.audit_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_reference uuid NOT NULL UNIQUE REFERENCES g2_sandbox.submissions(id) ON DELETE RESTRICT,
  scope_fingerprint text NOT NULL,
  amount integer NOT NULL CHECK (amount BETWEEN 1 AND 99999999),
  currency text NOT NULL CHECK (currency = 'usd'),
  quoted_by text NOT NULL CHECK (char_length(quoted_by) BETWEEN 1 AND 200),
  status text NOT NULL DEFAULT 'quoted' CHECK (status IN ('quoted', 'withdrawn')),
  quoted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE g2_sandbox.purchases
  ADD COLUMN quote_reference uuid REFERENCES g2_sandbox.audit_quotes(id) ON DELETE RESTRICT;

ALTER TABLE g2_sandbox.audit_quotes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON g2_sandbox.audit_quotes FROM PUBLIC, anon, authenticated, service_role;
