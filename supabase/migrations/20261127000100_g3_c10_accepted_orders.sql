-- G3: retain the exact C10 order accepted before Stripe checkout.
ALTER TABLE g2_sandbox.purchases
  ADD COLUMN IF NOT EXISTS accepted_order jsonb;

ALTER TABLE g2_sandbox.purchases
  DROP CONSTRAINT IF EXISTS g2_purchases_accepted_order_identity;

ALTER TABLE g2_sandbox.purchases
  ADD CONSTRAINT g2_purchases_accepted_order_identity CHECK (
    accepted_order IS NULL OR (
      accepted_order->>'documentType' = 'C10'
      AND length(accepted_order->>'reference') > 4
      AND length(accepted_order->>'version') > 4
      AND length(accepted_order->>'fingerprint') = 64
      AND accepted_order#>>'{acceptance,acceptedAt}' IS NOT NULL
    )
  );
