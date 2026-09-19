-- 1. Create tables
CREATE TABLE IF NOT EXISTS booking_billing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  garage_id UUID REFERENCES garages(id),
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  paid_to TEXT NOT NULL CHECK (paid_to IN ('garage','mechhelp')),
  status TEXT NOT NULL DEFAULT 'finalized' CHECK (status IN ('draft','finalized')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS garage_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  garage_id UUID REFERENCES garages(id),
  billing_id UUID REFERENCES booking_billing(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id),
  net_amount NUMERIC(10,2) NOT NULL, -- positive = garage owes mechhelp, negative = mechhelp owes garage
  settled BOOLEAN NOT NULL DEFAULT false,
  settled_at TIMESTAMPTZ,
  settled_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS and add policies matching existing pattern (allow all access)
ALTER TABLE booking_billing ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE garage_settlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to booking_billing" ON booking_billing;
CREATE POLICY "Allow all access to booking_billing" ON booking_billing FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all access to billing_line_items" ON billing_line_items;
CREATE POLICY "Allow all access to billing_line_items" ON billing_line_items FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all access to garage_settlements" ON garage_settlements;
CREATE POLICY "Allow all access to garage_settlements" ON garage_settlements FOR ALL USING (true);

-- 2. Seed garages
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

-- 3. Add FK column to leads and backfill
ALTER TABLE leads ADD COLUMN IF NOT EXISTS garage_id UUID REFERENCES garages(id);

UPDATE leads l
SET garage_id = g.id
FROM garages g
WHERE TRIM(LOWER(l.garage_assigned)) = TRIM(LOWER(g.name))
  AND l.garage_id IS NULL;
