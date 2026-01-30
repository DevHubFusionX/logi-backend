-- 1. Drop the existing check constraint that limits service types
ALTER TABLE pricing_configs 
DROP CONSTRAINT IF EXISTS pricing_configs_service_type_check;

-- 2. Add a new check constraint that includes our new truck sizes
ALTER TABLE pricing_configs 
ADD CONSTRAINT pricing_configs_service_type_check 
CHECK (service_type IN ('standard', 'express', 'priority', 'economy', '5 Tons', '10 Tons', '15 Tons'));

-- 3. Now run the insert/update again
INSERT INTO pricing_configs (service_type, base_price, price_per_kg, price_per_km, is_active)
VALUES 
    ('5 Tons', 45000.00, 50.00, 100.00, true),
    ('10 Tons', 85000.00, 75.00, 150.00, true),
    ('15 Tons', 125000.00, 100.00, 200.00, true)
ON CONFLICT (service_type) 
DO UPDATE SET 
    base_price = EXCLUDED.base_price,
    price_per_kg = EXCLUDED.price_per_kg,
    price_per_km = EXCLUDED.price_per_km,
    updated_at = NOW();
