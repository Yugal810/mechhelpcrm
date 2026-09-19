-- 1. Profiles (Linked to auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  first_name TEXT,
  last_name TEXT,
  role TEXT DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Reference Tables
CREATE TABLE garages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE car_brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE car_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES car_brands(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(brand_id, name)
);

-- 3. Main Leads Table
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- Track who created it
  customer_name TEXT NOT NULL,
  lead_source TEXT NOT NULL,
  salesperson TEXT DEFAULT 'Choice',
  identifier TEXT NOT NULL,
  car_brand TEXT NOT NULL, -- Keep as text to support custom entries
  car_model TEXT NOT NULL, -- Keep as text to support custom entries
  priority TEXT NOT NULL DEFAULT 'Medium',
  lead_type TEXT NOT NULL,
  booking_type TEXT,
  garage_assigned TEXT,
  booking_date_time TIMESTAMPTZ,
  garage_notified BOOLEAN DEFAULT FALSE,
  next_follow_up_date DATE,
  last_contacted_date TIMESTAMPTZ,
  is_vip BOOLEAN DEFAULT FALSE,
  whatsapp_broadcast BOOLEAN DEFAULT FALSE,
  retarget_time_slot TEXT DEFAULT NULL,
  details_shared_at TIMESTAMPTZ DEFAULT NULL,
  number_plate TEXT DEFAULT NULL,
  notes TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Booking History
CREATE TABLE booking_history (
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

-- 5. Activity History
CREATE TABLE activity_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  outcome TEXT NOT NULL,
  notes TEXT
);

-- 6. Daily Call List (Sujal)
CREATE TABLE call_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_iq_tag TEXT NOT NULL,
  priority TEXT NOT NULL,
  status TEXT NOT NULL,
  linked_lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  date_added TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_leads_user_id ON leads(user_id);
CREATE INDEX idx_leads_lead_type ON leads(lead_type);
CREATE INDEX idx_leads_next_follow_up ON leads(next_follow_up_date);
CREATE INDEX idx_booking_history_lead_id ON booking_history(lead_id);
CREATE INDEX idx_activity_history_lead_id ON activity_history(lead_id);
CREATE INDEX idx_call_list_items_status ON call_list_items(status);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE garages ENABLE ROW LEVEL SECURITY;
ALTER TABLE car_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE car_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_list_items ENABLE ROW LEVEL SECURITY;

-- Create Policies (Internal CRM: Authenticated users can do everything)
CREATE POLICY "Auth users can full access profiles" ON profiles FOR ALL TO authenticated USING (true);
CREATE POLICY "Auth users can full access garages" ON garages FOR ALL TO authenticated USING (true);
CREATE POLICY "Auth users can full access car_brands" ON car_brands FOR ALL TO authenticated USING (true);
CREATE POLICY "Auth users can full access car_models" ON car_models FOR ALL TO authenticated USING (true);
CREATE POLICY "Auth users can full access leads" ON leads FOR ALL TO authenticated USING (true);
CREATE POLICY "Auth users can full access booking_history" ON booking_history FOR ALL TO authenticated USING (true);
CREATE POLICY "Auth users can full access activity_history" ON activity_history FOR ALL TO authenticated USING (true);
CREATE POLICY "Auth users can full access call_list_items" ON call_list_items FOR ALL TO authenticated USING (true);

-- 7. Daily Quicks summaries (see supabase/daily_summaries.sql for standalone migration)
CREATE TABLE IF NOT EXISTS daily_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  summary JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_summaries_date ON daily_summaries(date DESC);

ALTER TABLE daily_summaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to daily_summaries" ON daily_summaries;
CREATE POLICY "Allow all access to daily_summaries" ON daily_summaries FOR ALL USING (true);
