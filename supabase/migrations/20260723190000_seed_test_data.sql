/*
# Seed Test Student & Invoices

This migration seeds a demo student account (`student@unipay.com` / `Password123!`)
and fee invoices so that Stripe and M-Pesa payments can be tested end-to-end.
*/

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

DO $$
DECLARE
  v_user_id uuid := 'a1111111-1111-1111-1111-111111111111'::uuid;
  v_student_id uuid;
BEGIN
  -- Insert test student user into auth.users if not exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'student@unipay.com') THEN
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      role,
      aud
    ) VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'student@unipay.com',
      extensions.crypt('Password123!', extensions.gen_salt('bf')),
      now(),
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      '{"full_name": "Alex Mercer", "role": "customer", "phone": "254708374149", "student_number": "STU-2026-001", "program": "BSc Software Engineering", "year_of_study": 3}'::jsonb,
      now(),
      now(),
      'authenticated',
      'authenticated'
    );
  ELSE
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'student@unipay.com';
  END IF;

  -- Ensure profile exists
  INSERT INTO public.profiles (id, full_name, phone, role)
  VALUES (v_user_id, 'Alex Mercer', '254708374149', 'customer')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone;

  -- Ensure student record exists
  INSERT INTO public.students (user_id, student_number, program, year_of_study)
  VALUES (v_user_id, 'STU-2026-001', 'BSc Software Engineering', 3)
  ON CONFLICT (student_number) DO UPDATE SET
    program = EXCLUDED.program,
    year_of_study = EXCLUDED.year_of_study
  RETURNING id INTO v_student_id;

  IF v_student_id IS NULL THEN
    SELECT id INTO v_student_id FROM public.students WHERE student_number = 'STU-2026-001';
  END IF;

  -- Seed invoices if student has none
  IF NOT EXISTS (SELECT 1 FROM public.invoices WHERE student_id = v_student_id) THEN
    INSERT INTO public.invoices (invoice_number, student_id, title, description, amount, balance_due, status, due_date)
    VALUES
      ('INV-2026-001', v_student_id, 'Tuition Fee - Semester 1 2026', 'Full tuition fee for Semester 1 academic year 2026', 1500.00, 1500.00, 'unpaid', CURRENT_DATE + INTERVAL '30 days'),
      ('INV-2026-002', v_student_id, 'Laboratory & Technology Access Fee', 'Annual computer lab access and software license fee', 250.00, 250.00, 'unpaid', CURRENT_DATE + INTERVAL '15 days'),
      ('INV-2026-003', v_student_id, 'Library & Learning Resources Fee', 'Library membership and online database subscription', 100.00, 100.00, 'unpaid', CURRENT_DATE + INTERVAL '45 days');
  END IF;

END $$;
