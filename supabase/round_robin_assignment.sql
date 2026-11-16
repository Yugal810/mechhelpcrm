-- ==============================================================================
-- MECHHELP CRM: ROUND-ROBIN LEAD ASSIGNMENT & ROLE-BASED VISIBILITY
-- Safe & Idempotent: execute in the Supabase SQL Editor
-- ==============================================================================

-- 1. Ensure public.profiles defaults to 'sales' and stays synced with auth.users
ALTER TABLE public.profiles
  ALTER COLUMN role SET DEFAULT 'sales';

-- Backfill any existing auth.users missing from public.profiles
INSERT INTO public.profiles (id, email, first_name, last_name, role, created_at)
SELECT
  u.id,
  u.email,
  COALESCE(
    NULLIF(u.raw_user_meta_data->>'first_name', ''),
    NULLIF(split_part(COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', ''), ' ', 1), '')
  ),
  NULLIF(u.raw_user_meta_data->>'last_name', ''),
  CASE
    WHEN LOWER(u.email) = 'mechadmin@gmail.com' THEN 'admin'
    ELSE 'sales'
  END,
  COALESCE(u.created_at, NOW())
FROM auth.users u
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  first_name = COALESCE(EXCLUDED.first_name, public.profiles.first_name),
  last_name = COALESCE(EXCLUDED.last_name, public.profiles.last_name);

-- Normalize legacy 'user' / null roles and ensure mechadmin@gmail.com is admin
UPDATE public.profiles
SET role = 'admin'
WHERE LOWER(email) = 'mechadmin@gmail.com'
  AND role IS DISTINCT FROM 'admin';

UPDATE public.profiles
SET role = 'sales'
WHERE (role IS NULL OR role = 'user')
  AND LOWER(email) <> 'mechadmin@gmail.com';

-- Trigger function: sync new auth.users signups into public.profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, role, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'first_name', ''),
      NULLIF(split_part(COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''), ' ', 1), '')
    ),
    NULLIF(NEW.raw_user_meta_data->>'last_name', ''),
    CASE
      WHEN LOWER(NEW.email) = 'mechadmin@gmail.com' THEN 'admin'
      ELSE 'sales'
    END,
    COALESCE(NEW.created_at, NOW())
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    first_name = COALESCE(EXCLUDED.first_name, public.profiles.first_name),
    last_name = COALESCE(EXCLUDED.last_name, public.profiles.last_name);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger function: sync auth.users email/metadata updates into public.profiles
CREATE OR REPLACE FUNCTION public.handle_updated_user()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles
  SET
    email = NEW.email,
    first_name = COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'first_name', ''),
      NULLIF(split_part(COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''), ' ', 1), ''),
      first_name
    ),
    last_name = COALESCE(NULLIF(NEW.raw_user_meta_data->>'last_name', ''), last_name)
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE OF email, raw_user_meta_data ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_user();

-- 2. Add ownership columns to leads and call_list_items
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON public.leads(assigned_to);

ALTER TABLE public.call_list_items
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT auth.uid();

CREATE INDEX IF NOT EXISTS idx_call_list_items_created_by ON public.call_list_items(created_by);

-- 3. Round-Robin state table (tracks last assigned sales employee cursor)
CREATE TABLE IF NOT EXISTS public.round_robin_state (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_assigned_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.round_robin_state (id, last_assigned_user_id)
VALUES (1, NULL)
ON CONFLICT (id) DO NOTHING;

-- 4. Helper functions
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Picks the next 'sales' user in deterministic circular order (created_at, id).
-- Uses a transaction-level advisory lock so concurrent lead inserts never collide.
CREATE OR REPLACE FUNCTION public.pick_next_sales_user(p_exclude_user_id UUID DEFAULT NULL)
RETURNS UUID AS $$
DECLARE
  v_last_id UUID;
  v_last_created_at TIMESTAMPTZ;
  v_next_id UUID;
BEGIN
  PERFORM pg_advisory_xact_lock(9482716);

  SELECT last_assigned_user_id
  INTO v_last_id
  FROM public.round_robin_state
  WHERE id = 1;

  IF v_last_id IS NOT NULL THEN
    SELECT created_at
    INTO v_last_created_at
    FROM public.profiles
    WHERE id = v_last_id;
  END IF;

  IF v_last_created_at IS NOT NULL THEN
    SELECT id
    INTO v_next_id
    FROM public.profiles
    WHERE role = 'sales'
      AND (p_exclude_user_id IS NULL OR id <> p_exclude_user_id)
      AND (created_at, id) > (v_last_created_at, v_last_id)
    ORDER BY created_at ASC, id ASC
    LIMIT 1;
  END IF;

  IF v_next_id IS NULL THEN
    SELECT id
    INTO v_next_id
    FROM public.profiles
    WHERE role = 'sales'
      AND (p_exclude_user_id IS NULL OR id <> p_exclude_user_id)
    ORDER BY created_at ASC, id ASC
    LIMIT 1;
  END IF;

  UPDATE public.round_robin_state
  SET last_assigned_user_id = v_next_id,
      updated_at = NOW()
  WHERE id = 1;

  RETURN v_next_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. Triggers for round-robin assignment, reassignment guard, and employee deletion redistribution
CREATE OR REPLACE FUNCTION public.assign_lead_round_robin()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.assigned_to IS NULL THEN
    NEW.assigned_to := public.pick_next_sales_user(NULL);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_leads_round_robin ON public.leads;
CREATE TRIGGER trg_leads_round_robin
  BEFORE INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.assign_lead_round_robin();

CREATE OR REPLACE FUNCTION public.enforce_lead_assignment_permissions()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only an admin can reassign leads to another employee';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_leads_assignment_guard ON public.leads;
CREATE TRIGGER trg_leads_assignment_guard
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.enforce_lead_assignment_permissions();

CREATE OR REPLACE FUNCTION public.redistribute_deleted_employee_leads()
RETURNS TRIGGER AS $$
DECLARE
  v_lead RECORD;
  v_next_user_id UUID;
BEGIN
  FOR v_lead IN
    SELECT id
    FROM public.leads
    WHERE assigned_to = OLD.id
      AND COALESCE(lead_type, 'Fresh Lead') NOT IN ('Booked', 'Completed', 'Lost')
    ORDER BY created_date ASC NULLS LAST, id ASC
  LOOP
    v_next_user_id := public.pick_next_sales_user(OLD.id);
    UPDATE public.leads
    SET assigned_to = v_next_user_id
    WHERE id = v_lead.id;
  END LOOP;

  UPDATE public.round_robin_state
  SET last_assigned_user_id = NULL,
      updated_at = NOW()
  WHERE id = 1
    AND last_assigned_user_id = OLD.id;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_profiles_redistribute_open_leads ON public.profiles;
CREATE TRIGGER trg_profiles_redistribute_open_leads
  BEFORE DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.redistribute_deleted_employee_leads();

CREATE OR REPLACE FUNCTION public.set_call_list_created_by()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_call_list_items_created_by ON public.call_list_items;
CREATE TRIGGER trg_call_list_items_created_by
  BEFORE INSERT ON public.call_list_items
  FOR EACH ROW EXECUTE FUNCTION public.set_call_list_created_by();

-- 6. Admin RPC & immediate initial distribution of existing unassigned open/active leads
CREATE OR REPLACE FUNCTION public.distribute_unassigned_open_leads()
RETURNS INTEGER AS $$
DECLARE
  v_lead RECORD;
  v_next_user_id UUID;
  v_count INTEGER := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only an admin can distribute leads';
  END IF;

  FOR v_lead IN
    SELECT id
    FROM public.leads
    WHERE assigned_to IS NULL
      AND COALESCE(lead_type, 'Fresh Lead') NOT IN ('Booked', 'Completed', 'Lost')
    ORDER BY created_date ASC NULLS LAST, id ASC
  LOOP
    v_next_user_id := public.pick_next_sales_user(NULL);
    EXIT WHEN v_next_user_id IS NULL;

    UPDATE public.leads
    SET assigned_to = v_next_user_id
    WHERE id = v_lead.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Distribute all currently unassigned open/active leads evenly across existing sales users
SELECT public.distribute_unassigned_open_leads();

-- 7. Row-Level Security (RLS) policies
ALTER TABLE public.round_robin_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin can read round_robin_state" ON public.round_robin_state;
CREATE POLICY "Admin can read round_robin_state"
  ON public.round_robin_state
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- profiles: authenticated users can read directory; only admin can update roles/profiles
DROP POLICY IF EXISTS "Allow all access to profiles" ON public.profiles;
DROP POLICY IF EXISTS "Auth users can full access profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin can update profiles" ON public.profiles;

CREATE POLICY "Authenticated users can read profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin can update profiles"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- leads: authenticated users can read leads (employees see all on Bookings/Reports/etc.
-- and Overview + Leads & Reminders pages filter to assigned_to = auth.uid()).
-- Employees can insert self-assigned leads and delete only their own assigned leads.
-- Reassignment is blocked for non-admins by trg_leads_assignment_guard.
DROP POLICY IF EXISTS "Allow all access to leads" ON public.leads;
DROP POLICY IF EXISTS "Auth users can full access leads" ON public.leads;
DROP POLICY IF EXISTS "Auth users can read leads" ON public.leads;
DROP POLICY IF EXISTS "Auth users can insert leads" ON public.leads;
DROP POLICY IF EXISTS "Auth users can update leads" ON public.leads;
DROP POLICY IF EXISTS "Users delete own or admin deletes any lead" ON public.leads;

CREATE POLICY "Auth users can read leads"
  ON public.leads
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Auth users can insert leads"
  ON public.leads
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin() OR assigned_to = auth.uid());

CREATE POLICY "Auth users can update leads"
  ON public.leads
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users delete own or admin deletes any lead"
  ON public.leads
  FOR DELETE
  TO authenticated
  USING (public.is_admin() OR assigned_to = auth.uid());

-- call_list_items: each employee only sees & manages Quick Tag items they added; admin sees all
DROP POLICY IF EXISTS "Allow all access to call_list_items" ON public.call_list_items;
DROP POLICY IF EXISTS "Auth users can full access call_list_items" ON public.call_list_items;
DROP POLICY IF EXISTS "Users read own or admin reads all call_list_items" ON public.call_list_items;
DROP POLICY IF EXISTS "Users insert own call_list_items" ON public.call_list_items;
DROP POLICY IF EXISTS "Users update own or admin updates all call_list_items" ON public.call_list_items;
DROP POLICY IF EXISTS "Users delete own or admin deletes all call_list_items" ON public.call_list_items;

CREATE POLICY "Users read own or admin reads all call_list_items"
  ON public.call_list_items
  FOR SELECT
  TO authenticated
  USING (public.is_admin() OR created_by = auth.uid());

CREATE POLICY "Users insert own call_list_items"
  ON public.call_list_items
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin() OR created_by = auth.uid() OR created_by IS NULL);

CREATE POLICY "Users update own or admin updates all call_list_items"
  ON public.call_list_items
  FOR UPDATE
  TO authenticated
  USING (public.is_admin() OR created_by = auth.uid())
  WITH CHECK (public.is_admin() OR created_by = auth.uid());

CREATE POLICY "Users delete own or admin deletes all call_list_items"
  ON public.call_list_items
  FOR DELETE
  TO authenticated
  USING (public.is_admin() OR created_by = auth.uid());

-- Ensure Realtime also broadcasts profiles table updates if publication exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END $$;

