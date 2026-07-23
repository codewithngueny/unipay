/*
# University Fee Payment System — Initial Schema

1. Overview
This migration creates the complete schema for a University Fee Payment System
supporting three roles (Administrator, Accountant, Customer/Student). It covers
user profiles, students, payment methods, invoices, payments, and receipts.

2. New Tables
- `profiles` — extends auth.users with role (admin/accountant/customer), full name, phone.
- `students` — student records linked to a user profile (student number, program, year).
- `payment_methods` — configurable payment methods (card, mobile money, bank transfer, cash).
- `invoices` — fee invoices issued to students (tuition, library, lab, etc.) with status and balance.
- `payments` — payments made against invoices, linked to a payment method and student.
- `receipts` — generated receipts for successful payments, with receipt number.

3. Security
- RLS enabled on every table.
- profiles: each authenticated user can read/update own profile; admins can read all.
- students: owners read/update own; admin/accountant read all.
- payment_methods: admin full CRUD; authenticated read.
- invoices: students read own; admin/accountant read all + insert/update.
- payments: students read own + insert own; admin/accountant read all.
- receipts: students read own; admin/accountant read all + insert.

4. Notes
- `user_id` columns default to `auth.uid()` so client inserts omitting the owner succeed.
- Status enums are modeled with TEXT + CHECK constraints for portability.
- Invoice `balance_due` is maintained via trigger after payment insert.
*/

-- PROFILES
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text,
  role text NOT NULL DEFAULT 'customer' CHECK (role IN ('admin','accountant','customer')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON profiles;
CREATE POLICY "profiles_select_own_or_admin" ON profiles
  FOR SELECT TO authenticated
  USING (
    auth.uid() = id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert_self" ON profiles;
CREATE POLICY "profiles_insert_self" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- STUDENTS
CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  student_number text UNIQUE NOT NULL,
  program text NOT NULL,
  year_of_study int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "students_select_own_or_staff" ON students;
CREATE POLICY "students_select_own_or_staff" ON students
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','accountant'))
  );

DROP POLICY IF EXISTS "students_insert_own" ON students;
CREATE POLICY "students_insert_own" ON students
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "students_update_own_or_admin" ON students;
CREATE POLICY "students_update_own_or_admin" ON students
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- PAYMENT METHODS
CREATE TABLE IF NOT EXISTS payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payment_methods_select_authenticated" ON payment_methods;
CREATE POLICY "payment_methods_select_authenticated" ON payment_methods
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "payment_methods_admin_insert" ON payment_methods;
CREATE POLICY "payment_methods_admin_insert" ON payment_methods
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "payment_methods_admin_update" ON payment_methods;
CREATE POLICY "payment_methods_admin_update" ON payment_methods
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "payment_methods_admin_delete" ON payment_methods;
CREATE POLICY "payment_methods_admin_delete" ON payment_methods
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- INVOICES
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text UNIQUE NOT NULL,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  balance_due numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid','partial','paid','overdue')),
  due_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoices_select_owner_or_staff" ON invoices;
CREATE POLICY "invoices_select_owner_or_staff" ON invoices
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM students s WHERE s.id = invoices.student_id AND s.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','accountant'))
  );

DROP POLICY IF EXISTS "invoices_insert_staff" ON invoices;
CREATE POLICY "invoices_insert_staff" ON invoices
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','accountant')));

DROP POLICY IF EXISTS "invoices_update_staff" ON invoices;
CREATE POLICY "invoices_update_staff" ON invoices
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','accountant')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','accountant')));

-- PAYMENTS
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_reference text UNIQUE NOT NULL,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  payment_method_id uuid NOT NULL REFERENCES payment_methods(id),
  amount numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'successful' CHECK (status IN ('successful','failed','pending')),
  payer_details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payments_select_owner_or_staff" ON payments;
CREATE POLICY "payments_select_owner_or_staff" ON payments
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM students s WHERE s.id = payments.student_id AND s.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','accountant'))
  );

DROP POLICY IF EXISTS "payments_insert_owner_or_staff" ON payments;
CREATE POLICY "payments_insert_owner_or_staff" ON payments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM students s WHERE s.id = payments.student_id AND s.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','accountant'))
  );

-- RECEIPTS
CREATE TABLE IF NOT EXISTS receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number text UNIQUE NOT NULL,
  payment_id uuid NOT NULL UNIQUE REFERENCES payments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "receipts_select_owner_or_staff" ON receipts;
CREATE POLICY "receipts_select_owner_or_staff" ON receipts
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM students s WHERE s.id = receipts.student_id AND s.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','accountant'))
  );

DROP POLICY IF EXISTS "receipts_insert_staff" ON receipts;
CREATE POLICY "receipts_insert_staff" ON receipts
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','accountant')));

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_invoices_student ON invoices(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_student ON payments(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_method ON payments(payment_method_id);
CREATE INDEX IF NOT EXISTS idx_payments_created ON payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_receipts_payment ON receipts(payment_id);
CREATE INDEX IF NOT EXISTS idx_receipts_student ON receipts(student_id);

-- FUNCTION: generate invoice number
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS text AS $$
DECLARE
  seq int;
  num text;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 9) AS int)), 0) + 1
  INTO seq FROM invoices WHERE invoice_number LIKE 'INV-%';
  num := 'INV-' || lpad(seq::text, 6, '0');
  RETURN num;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- FUNCTION: generate payment reference
CREATE OR REPLACE FUNCTION generate_payment_reference()
RETURNS text AS $$
DECLARE
  seq int;
  ref text;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(payment_reference FROM 9) AS int)), 0) + 1
  INTO seq FROM payments WHERE payment_reference LIKE 'PAY-REF-%';
  ref := 'PAY-REF-' || lpad(seq::text, 6, '0');
  RETURN ref;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- FUNCTION: generate receipt number
CREATE OR REPLACE FUNCTION generate_receipt_number()
RETURNS text AS $$
DECLARE
  seq int;
  num text;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(receipt_number FROM 9) AS int)), 0) + 1
  INTO seq FROM receipts WHERE receipt_number LIKE 'RCP-0000%';
  num := 'RCP-' || lpad(seq::text, 6, '0');
  RETURN num;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- TRIGGER: auto-create profile on auth signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, full_name, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'), COALESCE(NEW.raw_user_meta_data->>'role', 'customer'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- TRIGGER: update invoice balance + status after payment
CREATE OR REPLACE FUNCTION update_invoice_after_payment()
RETURNS trigger AS $$
DECLARE
  paid_total numeric(12,2);
  inv_amount numeric(12,2);
  new_balance numeric(12,2);
  new_status text;
BEGIN
  IF NEW.status = 'successful' THEN
    SELECT amount INTO inv_amount FROM invoices WHERE id = NEW.invoice_id;
    SELECT COALESCE(SUM(amount), 0) INTO paid_total
    FROM payments WHERE invoice_id = NEW.invoice_id AND status = 'successful';
    new_balance := inv_amount - paid_total;
    IF new_balance <= 0 THEN
      new_status := 'paid';
    ELSIF new_balance < inv_amount THEN
      new_status := 'partial';
    ELSE
      new_status := 'unpaid';
    END IF;
    UPDATE invoices SET balance_due = GREATEST(new_balance, 0), status = new_status
    WHERE id = NEW.invoice_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_payment_update_invoice ON payments;
CREATE TRIGGER trg_payment_update_invoice
  AFTER INSERT ON payments
  FOR EACH ROW EXECUTE FUNCTION update_invoice_after_payment();
