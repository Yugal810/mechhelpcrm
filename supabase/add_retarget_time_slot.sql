-- Migration: Add retarget_time_slot column to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS retarget_time_slot TEXT DEFAULT NULL;
