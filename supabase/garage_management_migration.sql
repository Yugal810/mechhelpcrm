-- Run this in Supabase SQL Editor before deploying the new code.

-- 1. Soft-delete flag on garages (preserves FK references from leads/settlements)
ALTER TABLE garages ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- 2. Partial payments table
--    direction: 'garage_to_mechhelp' = garage owes and pays MechHelp
--               'mechhelp_to_garage' = MechHelp owes and pays garage
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
CREATE POLICY "Auth users can full access garage_payments"
  ON garage_payments FOR ALL TO authenticated USING (true);
CREATE POLICY "Anon can full access garage_payments"
  ON garage_payments FOR ALL TO anon USING (true);

-- Allow anon access to garages (needed for local dev without auth)
DROP POLICY IF EXISTS "Anon can full access garages" ON garages;
CREATE POLICY "Anon can full access garages"
  ON garages FOR ALL TO anon USING (true);
