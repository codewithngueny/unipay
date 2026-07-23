/*
# Fix infinite recursion in RLS policies

1. Problem
The profiles SELECT policy and several other policies query `profiles` itself
to check if the current user is an admin/accountant. This causes infinite
recursion because evaluating the policy on `profiles` triggers the same policy
again.

2. Solution
Replace the subquery-based admin check with a SECURITY DEFINER function
`is_staff()` that reads the role from `profiles` without going through RLS.
This breaks the recursion because the function runs with elevated privileges
and bypasses RLS on `profiles`.

3. Changes
- Create `is_staff()` helper function (SECURITY DEFINER, bypasses RLS).
- Rewrite all policies that had `EXISTS (SELECT 1 FROM profiles ...)` to use
  `is_staff()` or `is_admin()` instead.
- Affects: profiles, students, invoices, payments, receipts.
*/

-- Helper functions that bypass RLS to avoid recursion
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role IN ('admin', 'accountant')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  );
$$;

-- PROFILES: fix recursive policy
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON profiles;
CREATE POLICY "profiles_select_own_or_admin" ON profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert_self" ON profiles;
CREATE POLICY "profiles_insert_self" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- STUDENTS: fix recursive policy
DROP POLICY IF EXISTS "students_select_own_or_staff" ON students;
CREATE POLICY "students_select_own_or_staff" ON students
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_staff());

DROP POLICY IF EXISTS "students_insert_own" ON students;
CREATE POLICY "students_insert_own" ON students
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "students_update_own_or_admin" ON students;
CREATE POLICY "students_update_own_or_admin" ON students
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- PAYMENT METHODS: fix recursive policy
DROP POLICY IF EXISTS "payment_methods_select_authenticated" ON payment_methods;
CREATE POLICY "payment_methods_select_authenticated" ON payment_methods
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "payment_methods_admin_insert" ON payment_methods;
CREATE POLICY "payment_methods_admin_insert" ON payment_methods
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "payment_methods_admin_update" ON payment_methods;
CREATE POLICY "payment_methods_admin_update" ON payment_methods
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "payment_methods_admin_delete" ON payment_methods;
CREATE POLICY "payment_methods_admin_delete" ON payment_methods
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- INVOICES: fix recursive policy
DROP POLICY IF EXISTS "invoices_select_owner_or_staff" ON invoices;
CREATE POLICY "invoices_select_owner_or_staff" ON invoices
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM students s WHERE s.id = invoices.student_id AND s.user_id = auth.uid())
    OR public.is_staff()
  );

DROP POLICY IF EXISTS "invoices_insert_staff" ON invoices;
CREATE POLICY "invoices_insert_staff" ON invoices
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "invoices_update_staff" ON invoices;
CREATE POLICY "invoices_update_staff" ON invoices
  FOR UPDATE TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- PAYMENTS: fix recursive policy
DROP POLICY IF EXISTS "payments_select_owner_or_staff" ON payments;
CREATE POLICY "payments_select_owner_or_staff" ON payments
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM students s WHERE s.id = payments.student_id AND s.user_id = auth.uid())
    OR public.is_staff()
  );

DROP POLICY IF EXISTS "payments_insert_owner_or_staff" ON payments;
CREATE POLICY "payments_insert_owner_or_staff" ON payments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM students s WHERE s.id = payments.student_id AND s.user_id = auth.uid())
    OR public.is_staff()
  );

-- RECEIPTS: fix recursive policy
DROP POLICY IF EXISTS "receipts_select_owner_or_staff" ON receipts;
CREATE POLICY "receipts_select_owner_or_staff" ON receipts
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM students s WHERE s.id = receipts.student_id AND s.user_id = auth.uid())
    OR public.is_staff()
  );

DROP POLICY IF EXISTS "receipts_insert_staff" ON receipts;
CREATE POLICY "receipts_insert_staff" ON receipts
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff());
