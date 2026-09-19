-- Migration: Add number_plate column to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS number_plate TEXT DEFAULT NULL;
