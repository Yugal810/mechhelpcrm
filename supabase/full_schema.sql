-- ==========================================
-- MechHelp CRM Complete Supabase Database Schema
-- Run this script in your new Supabase Project SQL Editor
-- ==========================================

-- 1. PROFILES (Linked to auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  first_name TEXT,
  last_name TEXT,
  role TEXT DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to auto-create profile on new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. GARAGES
CREATE TABLE IF NOT EXISTS garages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. CAR BRANDS & MODELS
CREATE TABLE IF NOT EXISTS car_brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS car_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES car_brands(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(brand_id, name)
);

-- 4. MAIN LEADS TABLE
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  lead_source TEXT NOT NULL,
  salesperson TEXT DEFAULT 'Choice',
  identifier TEXT NOT NULL,
  car_brand TEXT NOT NULL,
  car_model TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'Medium',
  lead_type TEXT NOT NULL,
  booking_type TEXT,
  garage_assigned TEXT,
  garage_id UUID REFERENCES garages(id),
  booking_date_time TIMESTAMPTZ,
  garage_notified BOOLEAN DEFAULT FALSE,
  next_follow_up_date DATE,
  last_contacted_date TIMESTAMPTZ,
  is_vip BOOLEAN DEFAULT FALSE,
  whatsapp_broadcast BOOLEAN DEFAULT FALSE,
  retarget_time_slot TEXT DEFAULT NULL,
  details_shared_at TIMESTAMPTZ DEFAULT NULL,
  number_plate TEXT DEFAULT NULL,
  service_type TEXT,
  notes TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW()
);

-- 5. BOOKING HISTORY (Reschedules)
CREATE TABLE IF NOT EXISTS booking_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  previous_date TEXT,
  previous_time TEXT,
  previous_garage TEXT,
  new_date TEXT,
  new_time TEXT,
  new_garage TEXT,
  reason TEXT,
  remarks TEXT,
  rescheduled_by TEXT,
  rescheduled_on TIMESTAMPTZ DEFAULT NOW()
);

-- 6. ACTIVITY HISTORY
CREATE TABLE IF NOT EXISTS activity_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  outcome TEXT NOT NULL,
  notes TEXT
);

-- 7. CALL LIST ITEMS
CREATE TABLE IF NOT EXISTS call_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_iq_tag TEXT NOT NULL,
  priority TEXT NOT NULL,
  status TEXT NOT NULL,
  linked_lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  date_added TIMESTAMPTZ DEFAULT NOW()
);

-- 8. DAILY GARAGE BOARD ENTRIES
CREATE TABLE IF NOT EXISTS daily_garage_board_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  garage_id UUID REFERENCES garages(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  car_name TEXT NOT NULL,
  number_plate TEXT,
  source TEXT NOT NULL DEFAULT 'custom' CHECK (source IN ('salesiq', 'custom')),
  notes TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'arrived', 'done')),
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  created_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. BOOKING BILLING
CREATE TABLE IF NOT EXISTS booking_billing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  garage_id UUID REFERENCES garages(id),
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount NUMERIC(10,2) DEFAULT 0,
  paid_to TEXT NOT NULL CHECK (paid_to IN ('garage','mechhelp')),
  status TEXT NOT NULL DEFAULT 'finalized' CHECK (status IN ('draft','finalized')),
  final_settlement BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. BILLING LINE ITEMS
CREATE TABLE IF NOT EXISTS billing_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_id UUID REFERENCES booking_billing(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  split_enabled BOOLEAN NOT NULL DEFAULT true,
  mechhelp_pct NUMERIC(5,2) NOT NULL DEFAULT 20,
  garage_pct NUMERIC(5,2) NOT NULL DEFAULT 80,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. GARAGE SETTLEMENTS
CREATE TABLE IF NOT EXISTS garage_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  garage_id UUID REFERENCES garages(id),
  billing_id UUID REFERENCES booking_billing(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id),
  net_amount NUMERIC(10,2) NOT NULL,
  settled BOOLEAN NOT NULL DEFAULT false,
  final_settlement BOOLEAN DEFAULT false,
  settled_at TIMESTAMPTZ,
  settled_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. GARAGE PAYMENTS
CREATE TABLE IF NOT EXISTS garage_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  garage_id UUID NOT NULL REFERENCES garages(id),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  direction TEXT NOT NULL CHECK (direction IN ('garage_to_mechhelp','mechhelp_to_garage')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. DAILY SUMMARIES
CREATE TABLE IF NOT EXISTS daily_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  summary JSONB NOT NULL,
  email_sent BOOLEAN DEFAULT false,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_leads_user_id ON leads(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_lead_type ON leads(lead_type);
CREATE INDEX IF NOT EXISTS idx_leads_next_follow_up ON leads(next_follow_up_date);
CREATE INDEX IF NOT EXISTS idx_booking_history_lead_id ON booking_history(lead_id);
CREATE INDEX IF NOT EXISTS idx_activity_history_lead_id ON activity_history(lead_id);
CREATE INDEX IF NOT EXISTS idx_call_list_items_status ON call_list_items(status);
CREATE INDEX IF NOT EXISTS idx_dgb_entries_date ON daily_garage_board_entries(created_date);
CREATE INDEX IF NOT EXISTS idx_dgb_entries_garage ON daily_garage_board_entries(garage_id);
CREATE INDEX IF NOT EXISTS idx_garage_payments_garage_id ON garage_payments(garage_id);
CREATE INDEX IF NOT EXISTS idx_daily_summaries_date ON daily_summaries(date DESC);

-- ENABLE ROW LEVEL SECURITY (RLS) & PUBLIC ACCESS POLICIES
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE garages ENABLE ROW LEVEL SECURITY;
ALTER TABLE car_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE car_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_garage_board_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_billing ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE garage_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE garage_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow full access profiles" ON profiles FOR ALL USING (true);
CREATE POLICY "Allow full access garages" ON garages FOR ALL USING (true);
CREATE POLICY "Allow full access car_brands" ON car_brands FOR ALL USING (true);
CREATE POLICY "Allow full access car_models" ON car_models FOR ALL USING (true);
CREATE POLICY "Allow full access leads" ON leads FOR ALL USING (true);
CREATE POLICY "Allow full access booking_history" ON booking_history FOR ALL USING (true);
CREATE POLICY "Allow full access activity_history" ON activity_history FOR ALL USING (true);
CREATE POLICY "Allow full access call_list_items" ON call_list_items FOR ALL USING (true);
CREATE POLICY "Allow full access daily_garage_board_entries" ON daily_garage_board_entries FOR ALL USING (true);
CREATE POLICY "Allow full access booking_billing" ON booking_billing FOR ALL USING (true);
CREATE POLICY "Allow full access billing_line_items" ON billing_line_items FOR ALL USING (true);
CREATE POLICY "Allow full access garage_settlements" ON garage_settlements FOR ALL USING (true);
CREATE POLICY "Allow full access garage_payments" ON garage_payments FOR ALL USING (true);
CREATE POLICY "Allow full access daily_summaries" ON daily_summaries FOR ALL USING (true);

-- SEED INITIAL GARAGES
INSERT INTO garages (name) VALUES
  ('Umar Automobiles'),
  ('V.S Car Care'),
  ('Shree Govind Automobile'),
  ('Sarkar Garage'),
  ('The Engine Room'),
  ('Car Hub'),
  ('D & G Auto Care'),
  ('B.S Autopoint'),
  ('The Mechanic'),
  ('Car Way Motors'),
  ('Good Luck Automobile'),
  ('New Friends Automobiles and Auto Electrics'),
  ('S-Drive Auto Care'),
  ('Shivaji Motors'),
  ('Fulsunge Automobiles'),
  ('Moving Wheels Car Garage'),
  ('Taj Automobiles'),
  ('Rathi Autoworks')
ON CONFLICT (name) DO NOTHING;
