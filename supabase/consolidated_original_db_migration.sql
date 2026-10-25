-- ==============================================================================
-- MECHHELP CRM: CONSOLIDATED SCHEMA MIGRATION FOR ORIGINAL/PRODUCTION DATABASE
-- Safe & Idempotent: can be executed directly in the Supabase SQL Editor
-- ==============================================================================

-- 1. LEADS TABLE UPDATES
-- Adds new columns for vehicle fuel/year specs, feedback/rating, salesperson, number plates & tracking
ALTER TABLE leads 
  ADD COLUMN IF NOT EXISTS salesperson TEXT DEFAULT 'Choice',
  ADD COLUMN IF NOT EXISTS fuel_type TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS custom_year TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS number_plate TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS retarget_time_slot TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS details_shared_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS rating INTEGER CHECK (rating >= 1 AND rating <= 10),
  ADD COLUMN IF NOT EXISTS feedback_notes TEXT,
  ADD COLUMN IF NOT EXISTS garage_id UUID REFERENCES garages(id);

-- Backfill garage_id from garage_assigned text name if missing
UPDATE leads l
SET garage_id = g.id
FROM garages g
WHERE TRIM(LOWER(l.garage_assigned)) = TRIM(LOWER(g.name))
  AND l.garage_id IS NULL;

-- Case-insensitive UNIQUE index on SalesIQ Tag
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_unique_salesiq_tag 
ON leads (LOWER(TRIM(identifier))) 
WHERE lead_source = 'SalesIQ';


-- 2. GARAGES TABLE UPDATES
-- Soft-delete flag so archived garages keep foreign key references intact
ALTER TABLE garages 
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;


-- 3. DAILY GARAGE BOARD (OPERATIONS BOARD)
CREATE TABLE IF NOT EXISTS daily_garage_board_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_date DATE NOT NULL DEFAULT CURRENT_DATE,
  garage_id UUID REFERENCES garages(id),
  customer_name TEXT,
  phone TEXT,
  car_brand TEXT,
  car_model TEXT,
  number_plate TEXT,
  source TEXT NOT NULL DEFAULT 'custom',
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure correct check constraints on daily_garage_board_entries
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT constraint_name 
        FROM information_schema.table_constraints 
        WHERE table_name = 'daily_garage_board_entries' 
          AND constraint_type = 'CHECK'
    ) LOOP
        EXECUTE 'ALTER TABLE daily_garage_board_entries DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name);
    END LOOP;
END $$;

-- Update legacy 'converted' status to 'done'
UPDATE daily_garage_board_entries SET status = 'done' WHERE status = 'converted';

-- Add updated check constraints (supports: 'pending', 'picked_up', 'arrived', 'done')
ALTER TABLE daily_garage_board_entries 
  ADD CONSTRAINT daily_garage_board_entries_status_check 
  CHECK (status IN ('pending', 'picked_up', 'arrived', 'done'));

ALTER TABLE daily_garage_board_entries 
  ADD CONSTRAINT daily_garage_board_entries_source_check 
  CHECK (source IN ('salesiq', 'custom'));

ALTER TABLE daily_garage_board_entries ADD COLUMN IF NOT EXISTS number_plate TEXT;
ALTER TABLE daily_garage_board_entries ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'custom';
ALTER TABLE daily_garage_board_entries ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES leads(id) ON DELETE SET NULL;
ALTER TABLE daily_garage_board_entries ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_dgb_entries_date ON daily_garage_board_entries(created_date);
CREATE INDEX IF NOT EXISTS idx_dgb_entries_garage ON daily_garage_board_entries(garage_id);

ALTER TABLE daily_garage_board_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to daily_garage_board_entries" ON daily_garage_board_entries;
CREATE POLICY "Allow all access to daily_garage_board_entries"
  ON daily_garage_board_entries FOR ALL USING (true);


-- 4. SETTLEMENTS & BILLING (FINAL SETTLEMENT TRACKING)
ALTER TABLE booking_billing 
  ADD COLUMN IF NOT EXISTS final_settlement BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE garage_settlements 
  ADD COLUMN IF NOT EXISTS final_settlement BOOLEAN NOT NULL DEFAULT FALSE;


-- 5. GARAGE PAYMENTS TABLE (PARTIAL PAYMENTS)
CREATE TABLE IF NOT EXISTS garage_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  garage_id UUID NOT NULL REFERENCES garages(id),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  direction TEXT NOT NULL CHECK (direction IN ('garage_to_mechhelp','mechhelp_to_garage')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_garage_payments_garage_id ON garage_payments(garage_id);

ALTER TABLE garage_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to garage_payments" ON garage_payments;
CREATE POLICY "Allow all access to garage_payments" ON garage_payments FOR ALL USING (true);


-- 6. DAILY SUMMARIES (DAILY QUICKS ARCHIVES)
CREATE TABLE IF NOT EXISTS daily_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  summary JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE daily_summaries 
  ADD COLUMN IF NOT EXISTS email_sent BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_daily_summaries_date ON daily_summaries(date DESC);

ALTER TABLE daily_summaries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to daily_summaries" ON daily_summaries;
CREATE POLICY "Allow all access to daily_summaries" ON daily_summaries FOR ALL USING (true);


-- 7. ACCESS POLICIES (INTERNAL CRM ACCESS FOR ALL ROLES)
DROP POLICY IF EXISTS "Auth users can full access profiles" ON profiles;
DROP POLICY IF EXISTS "Auth users can full access garages" ON garages;
DROP POLICY IF EXISTS "Auth users can full access car_brands" ON car_brands;
DROP POLICY IF EXISTS "Auth users can full access car_models" ON car_models;
DROP POLICY IF EXISTS "Auth users can full access leads" ON leads;
DROP POLICY IF EXISTS "Auth users can full access booking_history" ON booking_history;
DROP POLICY IF EXISTS "Auth users can full access activity_history" ON activity_history;
DROP POLICY IF EXISTS "Auth users can full access call_list_items" ON call_list_items;

CREATE POLICY "Allow all access to profiles" ON profiles FOR ALL USING (true);
CREATE POLICY "Allow all access to garages" ON garages FOR ALL USING (true);
CREATE POLICY "Allow all access to car_brands" ON car_brands FOR ALL USING (true);
CREATE POLICY "Allow all access to car_models" ON car_models FOR ALL USING (true);
CREATE POLICY "Allow all access to leads" ON leads FOR ALL USING (true);
CREATE POLICY "Allow all access to booking_history" ON booking_history FOR ALL USING (true);
CREATE POLICY "Allow all access to activity_history" ON activity_history FOR ALL USING (true);
CREATE POLICY "Allow all access to call_list_items" ON call_list_items FOR ALL USING (true);
