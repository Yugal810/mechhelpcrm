-- Migration to add final_settlement tracking for archiving closed bookings
ALTER TABLE booking_billing ADD COLUMN IF NOT EXISTS final_settlement BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE garage_settlements ADD COLUMN IF NOT EXISTS final_settlement BOOLEAN NOT NULL DEFAULT FALSE;
