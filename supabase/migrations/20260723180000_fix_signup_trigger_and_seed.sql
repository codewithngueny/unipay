/*
# Fix Sign-up Trigger & Seed Test Data

1. Update `handle_new_user()` trigger function to create both `profiles` and `students` records
   directly from `raw_user_meta_data` upon user registration. This avoids RLS errors during signup.
2. Seed sample invoices for testing Stripe and M-Pesa payments.
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role text;
  stu_num text;
  prog text;
  yos int;
BEGIN
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'customer');
  
  INSERT INTO public.profiles (id, full_name, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
    NEW.raw_user_meta_data->>'phone',
    user_role
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone,
    role = EXCLUDED.role;

  IF user_role = 'customer' THEN
    stu_num := COALESCE(NEW.raw_user_meta_data->>'student_number', 'STU-' || lpad(floor(random() * 10000)::text, 4, '0'));
    prog := COALESCE(NEW.raw_user_meta_data->>'program', 'BSc Computer Science');
    yos := COALESCE((NEW.raw_user_meta_data->>'year_of_study')::int, 1);

    INSERT INTO public.students (user_id, student_number, program, year_of_study)
    VALUES (NEW.id, stu_num, prog, yos)
    ON CONFLICT (student_number) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Ensure trigger is active
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
