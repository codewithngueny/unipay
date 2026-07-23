/*
# Add provider support for Stripe and M-Pesa payments

1. Changes to existing tables
- `payments` table: add `provider` (text, defaults to 'manual') to track which
  payment provider handled the transaction, and `provider_session_id` (text,
  nullable) to store the Stripe Checkout Session ID or M-Pesa CheckoutRequestID
  for correlation with provider webhooks/callbacks.
- `payment_methods` table: add an 'mpesa' row so students can select M-Pesa.

2. Security
- No new tables. RLS policies on `payments` already allow owner/staff inserts.
- The new columns are nullable/defaulted so existing rows are unaffected.

3. Important notes
- The `provider` column defaults to 'manual' so existing simulated payments
  remain valid.
- The `provider_session_id` is used by edge functions to correlate webhook
  events back to the correct payment row.
*/

-- Add provider columns to payments
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS provider_session_id text;

-- Add M-Pesa payment method if it doesn't exist
INSERT INTO payment_methods (name, code, description, is_active)
SELECT 'M-Pesa', 'mpesa', 'Pay via M-Pesa STK push', true
WHERE NOT EXISTS (SELECT 1 FROM payment_methods WHERE code = 'mpesa');

-- Update the auto_create_receipt trigger to only create receipts for
-- confirmed/successful payments (not pending ones). This prevents receipts
-- from being generated before Stripe/M-Pesa confirm the payment.
CREATE OR REPLACE FUNCTION public.auto_create_receipt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rcp_number text;
BEGIN
  -- Only create receipt when payment transitions to 'successful'
  IF NEW.status = 'successful' THEN
    -- Check if a receipt already exists for this payment
    IF NOT EXISTS (SELECT 1 FROM receipts WHERE payment_id = NEW.id) THEN
      SELECT public.generate_receipt_number() INTO rcp_number;
      INSERT INTO public.receipts (receipt_number, payment_id, student_id, amount)
      VALUES (rcp_number, NEW.id, NEW.student_id, NEW.amount);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Change the trigger to fire on both INSERT and UPDATE so it catches
-- status transitions from 'pending' to 'successful'
DROP TRIGGER IF EXISTS trg_auto_create_receipt ON payments;
CREATE TRIGGER trg_auto_create_receipt
  AFTER INSERT OR UPDATE OF status ON payments
  FOR EACH ROW EXECUTE FUNCTION public.auto_create_receipt();

-- Allow edge functions (service role) to update payment status
-- The existing RLS policies already cover this via is_staff(), but
-- edge functions use the service role key which bypasses RLS entirely.
