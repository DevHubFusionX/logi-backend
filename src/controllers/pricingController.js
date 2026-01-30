const { supabaseAdmin } = require('../config/supabase');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * @route   GET /api/pricing
 * @desc    Get all pricing configurations
 */
const getPricingConfigs = asyncHandler(async (req, res) => {
    let { data, error } = await supabaseAdmin
        .from('pricing_configs')
        .select('*')
        .order('service_type', { ascending: true });

    if (error) {
        // If table doesn't exist or other DB error, we still want to give a friendly error
        console.error("Database error fetching pricing:", error);
        throw error;
    }

    // Auto-seed if empty
    if (!data || data.length === 0) {
        const defaults = [
            { service_type: '5 tons', base_price: 45000.00, price_per_kg: 50.00, price_per_km: 100.00 },
            { service_type: '10 tons', base_price: 85000.00, price_per_kg: 75.00, price_per_km: 150.00 },
            { service_type: '15 tons', base_price: 125000.00, price_per_kg: 100.00, price_per_km: 200.00 }
        ];

        const { data: seeded, error: seedError } = await supabaseAdmin
            .from('pricing_configs')
            .insert(defaults)
            .select()
            .order('service_type', { ascending: true });

        if (seedError) {
            console.error("Auto-seeding failed:", seedError);
            // If seeding fails (e.g. table doesn't exist), return empty array so UI doesn't crash
            return res.json([]);
        }
        data = seeded;
    }

    res.json(data);
});

/**
 * @route   PUT /api/pricing/:id
 * @desc    Update a pricing configuration (Admin only)
 */
const updatePricingConfig = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { base_price, price_per_kg, price_per_km, is_active } = req.body;

    const { data, error } = await supabaseAdmin
        .from('pricing_configs')
        .update({
            base_price,
            price_per_kg,
            price_per_km,
            is_active,
            updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;

    res.json({
        message: 'Pricing configuration updated successfully',
        config: data
    });
});

/**
 * Internal helper to calculate price
 */
const calculatePriceInternal = async (serviceType, weight, distanceKm = 0) => {
    const normalizedServiceType = serviceType ? serviceType.toLowerCase().trim() : 'standard';

    const { data, error } = await supabaseAdmin
        .from('pricing_configs')
        .select('*')
        .ilike('service_type', normalizedServiceType)
        .eq('is_active', true)
        .order('id', { ascending: false }) // Get latest if multiple exist
        .limit(1)
        .maybeSingle(); // Better than .single() as it doesn't error on 0 results

    if (error || !data) {
        // Fallback default prices if config not found
        const fallbacks = {
            standard: { base: 1000, kg: 50, km: 10 },
            express: { base: 2500, kg: 100, km: 20 },
            '5 tons': { base: 45000, kg: 50, km: 100 },
            '10 tons': { base: 85000, kg: 75, km: 150 },
            '15 tons': { base: 125000, kg: 100, km: 200 }
        };
        const f = fallbacks[serviceType.toLowerCase()] || fallbacks.standard;
        return f.base + (f.kg * (weight || 0)) + (f.km * distanceKm);
    }

    const total = parseFloat(data.base_price) +
        (parseFloat(data.price_per_kg) * (weight || 0)) +
        (parseFloat(data.price_per_km) * distanceKm);

    return total;
};

/**
 * @route   POST /api/pricing/calculate
 * @desc    Calculate shipment price (Public)
 */
const calculatePrice = asyncHandler(async (req, res) => {
    const { serviceType, weight, distance } = req.body;

    if (!serviceType) {
        return res.status(400).json({ error: 'Service type is required' });
    }

    const price = await calculatePriceInternal(serviceType, weight, distance);

    res.json({
        serviceType,
        weight,
        distance,
        estimatedPrice: price
    });
});

module.exports = {
    getPricingConfigs,
    updatePricingConfig,
    calculatePrice,
    calculatePriceInternal
};
