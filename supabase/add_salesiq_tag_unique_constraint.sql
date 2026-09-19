-- Migration: Add UNIQUE constraint on SalesIQ Tag (identifier) in leads table
-- 1. Deduplicate any existing SalesIQ tags by appending a suffix to older duplicates
WITH duplicates AS (
  SELECT id, identifier,
         ROW_NUMBER() OVER (
           PARTITION BY LOWER(TRIM(identifier)) 
           ORDER BY created_date ASC, id ASC
         ) as rn
  FROM leads
  WHERE lead_source = 'SalesIQ' AND identifier IS NOT NULL AND TRIM(identifier) <> ''
)
UPDATE leads
SET identifier = leads.identifier || '-DUP-' || duplicates.rn
FROM duplicates
WHERE leads.id = duplicates.id AND duplicates.rn > 1;

-- 2. Create case-insensitive UNIQUE index on SalesIQ Tag
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_unique_salesiq_tag 
ON leads (LOWER(TRIM(identifier))) 
WHERE lead_source = 'SalesIQ';
