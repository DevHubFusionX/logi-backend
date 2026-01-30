-- Update or Insert pricing configurations for Ton-based trucks
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

-- Note: This assumes service_type is a unique column. 
-- If your table doesn't have a unique constraint on service_type, 
-- you can run these as individual UPDATE or INSERT statements.
