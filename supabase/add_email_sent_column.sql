-- Migration: Add email_sent flag to daily_summaries
-- Run this once against your Supabase project if the table already exists.
-- The email_sent flag lets the cron retry email delivery if it failed
-- in a previous run without treating the job as already-complete.

ALTER TABLE daily_summaries
  ADD COLUMN IF NOT EXISTS email_sent BOOLEAN NOT NULL DEFAULT FALSE;
