-- Robust Supabase Migration: Dynamic Drop of All Old Check Constraints & Setup

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

-- Add updated check constraints
ALTER TABLE daily_garage_board_entries ADD CONSTRAINT daily_garage_board_entries_status_check 
  CHECK (status IN ('pending', 'arrived', 'done'));

ALTER TABLE daily_garage_board_entries ADD CONSTRAINT daily_garage_board_entries_source_check 
  CHECK (source IN ('salesiq', 'custom'));

-- Ensure columns exist
ALTER TABLE daily_garage_board_entries ADD COLUMN IF NOT EXISTS number_plate TEXT;
ALTER TABLE daily_garage_board_entries ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'custom';
ALTER TABLE daily_garage_board_entries ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES leads(id) ON DELETE SET NULL;
ALTER TABLE daily_garage_board_entries ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';

-- Ensure indexes exist
CREATE INDEX IF NOT EXISTS idx_dgb_entries_date ON daily_garage_board_entries(created_date);
CREATE INDEX IF NOT EXISTS idx_dgb_entries_garage ON daily_garage_board_entries(garage_id);

-- Ensure RLS
ALTER TABLE daily_garage_board_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to daily_garage_board_entries" ON daily_garage_board_entries;
CREATE POLICY "Allow all access to daily_garage_board_entries"
  ON daily_garage_board_entries FOR ALL USING (true);
