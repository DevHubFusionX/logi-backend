-- Up Migration
-- Add contact_name and phone columns to addresses table
ALTER TABLE addresses 
ADD COLUMN IF NOT EXISTS contact_name TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT;

-- Down Migration (for rollback)
-- ALTER TABLE addresses DROP COLUMN contact_name;
-- ALTER TABLE addresses DROP COLUMN phone;
