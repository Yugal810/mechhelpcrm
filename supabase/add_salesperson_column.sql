-- Migration: Add salesperson column to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS salesperson TEXT DEFAULT 'Choice';
