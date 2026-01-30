-- Fix shipments service_type check constraint
-- Only allowing: '5 tons', '10 tons', '15 tons'
-- Run this in Supabase SQL Editor

-- Step 1: Drop the existing constraint first
ALTER TABLE shipments 
DROP CONSTRAINT IF EXISTS shipments_service_type_check;

-- Step 2: Standardize existing values to lowercase
UPDATE shipments 
SET service_type = LOWER(service_type)
WHERE service_type IS NOT NULL;

-- Step 3: Map any old values to '5 tons' (the default/smallest truck)
UPDATE shipments 
SET service_type = '5 tons'
WHERE service_type IS NULL 
   OR service_type NOT IN ('5 tons', '10 tons', '15 tons');

-- Step 4: Add the new constraint with only truck types
ALTER TABLE shipments 
ADD CONSTRAINT shipments_service_type_check 
CHECK (service_type IN ('5 tons', '10 tons', '15 tons'));

-- Verify the constraint was added
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conname = 'shipments_service_type_check';
