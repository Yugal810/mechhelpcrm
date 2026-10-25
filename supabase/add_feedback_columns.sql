-- Migration: Add rating and feedback_notes to leads table
-- Run this in your Supabase SQL Editor:

ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS rating INTEGER CHECK (rating >= 1 AND rating <= 10),
ADD COLUMN IF NOT EXISTS feedback_notes TEXT;
