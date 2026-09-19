-- Migration: Add details_shared_at column to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS details_shared_at TIMESTAMPTZ DEFAULT NULL;
