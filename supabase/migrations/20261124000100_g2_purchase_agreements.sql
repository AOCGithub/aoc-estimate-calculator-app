ALTER TABLE g2_sandbox.purchases
  ADD COLUMN purchase_agreement_version text,
  ADD COLUMN purchase_agreed_at timestamptz,
  ADD CONSTRAINT g2_purchase_agreement_pair CHECK (
    (purchase_agreement_version IS NULL AND purchase_agreed_at IS NULL)
    OR (char_length(purchase_agreement_version) BETWEEN 1 AND 100 AND purchase_agreed_at IS NOT NULL)
  );
