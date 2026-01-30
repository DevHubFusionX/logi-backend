const { supabaseAdmin } = require('../config/supabase');
const { generateTrackingNumber, calculateETA } = require('../utils/trackingNumber');
const config = require('../config');
const { calculatePriceInternal } = require('../controllers/pricingController');

/**
 * Service to handle shipment database operations
 */
const shipmentService = {
    /**
     * Create a new shipment
     */
    createShipment: async (userId, shipmentData) => {
        const {
            origin,
            destination,
            receiverName,
            receiverEmail,
            receiverPhone,
            weight,
            dimensions,
            serviceType,
            packageType,
            description,
            declaredValue,
            specialInstructions
        } = shipmentData;

        const parsedWeight = parseFloat(weight);
        const normalizedServiceType = serviceType ? serviceType.toLowerCase().trim() : '5 tons';

        const trackingNumber = generateTrackingNumber();
        const estimatedDelivery = calculateETA(normalizedServiceType);

        // Use pricing controller's internal helper for consistent fee calculation
        // Default distance to 0 if not provided (can be enhanced with Google Maps API later)
        const shippingFee = await calculatePriceInternal(normalizedServiceType, parsedWeight, 0);

        const { data, error } = await supabaseAdmin
            .from('shipments')
            .insert({
                sender_id: userId,
                tracking_number: trackingNumber,
                origin,
                destination,
                receiver_name: receiverName,
                receiver_email: receiverEmail,
                receiver_phone: receiverPhone,
                weight: parsedWeight,
                dimensions,
                service_type: normalizedServiceType,
                package_type: packageType ? packageType.toLowerCase() : 'parcel',
                description,
                declared_value: declaredValue ? parseFloat(declaredValue) : null,
                special_instructions: specialInstructions,
                status: config.shipmentStatus.PENDING,
                estimated_delivery: estimatedDelivery,
                shipping_fee: shippingFee
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Get shipment by ID with relations
     */
    getShipmentById: async (id) => {
        const { data, error } = await supabaseAdmin
            .from('shipments')
            .select(`
                *,
                sender:profiles!shipments_sender_id_fkey(id, first_name, last_name, email, phone),
                driver:drivers(profile:profiles(id, first_name, last_name, email, phone)),
                tracking_events(*)
            `)
            .eq('id', id)
            .single();

        if (error) return null;
        return data;
    },

    /**
     * Add tracking event to a shipment
     */
    addTrackingEvent: async (shipmentId, status, location, description) => {
        const { error } = await supabaseAdmin
            .from('tracking_events')
            .insert({
                shipment_id: shipmentId,
                status,
                location,
                description
            });

        if (error) throw error;
        return true;
    }
};

module.exports = shipmentService;
