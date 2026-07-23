/*
# Auto-create receipt on payment insert

1. Problem
The receipts table requires staff role for INSERT (RLS policy), but students
are the ones making payments. This means the receipt creation fails when a
student makes a payment through the frontend.

2. Solution
Create a trigger that automatically inserts a receipt row whenever a
successful payment is inserted. The trigger function is SECURITY DEFINER so it
bypasses RLS, and it generates the receipt number via the existing RPC function.

3. Changes
- Create `auto_create_receipt()` trigger function (SECURITY DEFINER).
- Attach as AFTER INSERT trigger on `payments`.
- Only creates a receipt for successful payments.
*/
CREATE OR REPLACE FUNCTION public.auto_create_receipt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rcp_number text;
BEGIN
  IF NEW.status = 'successful' THEN
    -- Generate receipt number
    SELECT public.generate_receipt_number() INTO rcp_number;
    -- Insert receipt (bypasses RLS due to SECURITY DEFINER)
    INSERT INTO public.receipts (receipt_number, payment_id, student_id, amount)
    VALUES (rcp_number, NEW.id, NEW.student_id, NEW.amount);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_create_receipt ON payments;
CREATE TRIGGER trg_auto_create_receipt
  AFTER INSERT ON payments
  FOR EACH ROW EXECUTE FUNCTION public.auto_create_receipt();
