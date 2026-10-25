-- Migration: Add fuel_type and custom_year columns to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS fuel_type TEXT DEFAULT NULL;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS custom_year TEXT DEFAULT NULL;
