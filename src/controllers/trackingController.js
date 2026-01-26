const { supabaseAdmin: supabase } = require('../config/supabase');
const { asyncHandler } = require('../middleware/errorHandler');
const { calculateDistance } = require('../utils/helpers');

/**
 * @route   GET /api/tracking/:trackingNumber
 * @desc    Track shipment by tracking number
 */
const trackShipment = asyncHandler(async (req, res) => {
    const { trackingNumber } = req.params;

    const { data, error } = await supabase
        .from('shipments')
        .select(`
            id,
            tracking_number,
            status,
            origin,
            destination,
            estimated_delivery,
            service_type,
            receiver_name,
            created_at,
            delivered_at,
            tracking_events(*)
        `)
        .eq('tracking_number', trackingNumber)
        .single();

    if (error || !data) {
        return res.status(404).json({
            error: 'Not Found',
            message: 'No shipment found with this tracking number'
        });
    }

    // Sort tracking events by date
    if (data.tracking_events) {
        data.tracking_events.sort((a, b) =>
            new Date(b.created_at) - new Date(a.created_at)
        );
    }

    res.json({
        trackingNumber: data.tracking_number,
        status: data.status,
        origin: data.origin,
        destination: data.destination,
        estimatedDelivery: data.estimated_delivery,
        serviceType: data.service_type,
        receiverName: data.receiver_name,
        createdAt: data.created_at,
        deliveredAt: data.delivered_at,
        events: data.tracking_events || []
    });
});

/**
 * @route   GET /api/tracking/:id/timeline
 * @desc    Get detailed timeline for a shipment
 */
const getTimeline = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const { data, error } = await supabase
        .from('tracking_events')
        .select('*')
        .eq('shipment_id', id)
        .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(data || []);
});

/**
 * @route   GET /api/tracking/:id/location
 * @desc    Get live location of shipment
 */
const getLiveLocation = asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Get shipment with driver
    const { data: shipment } = await supabase
        .from('shipments')
        .select(`
            id,
            status,
            driver:drivers(
                id,
                current_lat,
                current_lng,
                last_location_update
            )
        `)
        .eq('id', id)
        .single();

    if (!shipment || !shipment.driver) {
        return res.json({
            lat: null,
            lng: null,
            lastUpdated: null,
            message: 'Location not available'
        });
    }

    res.json({
        lat: shipment.driver.current_lat,
        lng: shipment.driver.current_lng,
        lastUpdated: shipment.driver.last_location_update
    });
});

/**
 * @route   GET /api/tracking/:id/driver
 * @desc    Get driver information for a shipment
 */
const getDriver = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const { data, error } = await supabase
        .from('shipments')
        .select(`
            driver:drivers(
                id,
                profile:profiles(first_name, last_name, phone, avatar_url),
                vehicle:vehicles(make, model, plate_number, type)
            )
        `)
        .eq('id', id)
        .single();

    if (error || !data?.driver) {
        return res.status(404).json({
            error: 'Not Found',
            message: 'No driver assigned to this shipment'
        });
    }

    const driver = data.driver;
    res.json({
        id: driver.id,
        name: `${driver.profile?.first_name || ''} ${driver.profile?.last_name || ''}`.trim(),
        phone: driver.profile?.phone,
        avatar: driver.profile?.avatar_url,
        vehicle: driver.vehicle ? {
            make: driver.vehicle.make,
            model: driver.vehicle.model,
            plateNumber: driver.vehicle.plate_number,
            type: driver.vehicle.type
        } : null
    });
});

/**
 * @route   GET /api/tracking/:id/eta
 * @desc    Get estimated time of arrival
 */
const getETA = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const { data: shipment } = await supabase
        .from('shipments')
        .select('estimated_delivery, status, destination')
        .eq('id', id)
        .single();

    if (!shipment) {
        return res.status(404).json({
            error: 'Not Found',
            message: 'Shipment not found'
        });
    }

    res.json({
        eta: shipment.estimated_delivery,
        status: shipment.status,
        distance: null // Would need geocoding to calculate
    });
});

/**
 * @route   GET /api/tracking/active
 * @desc    Get all active shipments being tracked
 */
const getActiveShipments = asyncHandler(async (req, res) => {
    const userId = req.user?.id;
    let userRole = 'user';

    // Fetch user role if logged in
    if (userId) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single();
        userRole = profile?.role || 'user';
    }

    let query = supabase
        .from('shipments')
        .select(`
            id,
            tracking_number,
            status,
            origin,
            destination,
            estimated_delivery,
            created_at,
            driver_id
        `)
        .in('status', ['pending', 'processing', 'in_transit', 'out_for_delivery']);

    // If user is authenticated and not admin, only show their shipments
    if (userId && userRole !== 'admin') {
        query = query.eq('sender_id', userId);
    } else if (!userId) {
        // If not logged in, they shouldn't see anything in the "active" list usually,
        // unless it's a completely public tracking feature. 
        // For now, let's keep it empty for unauthenticated users in the list.
        return res.json([]);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    res.json(data || []);
});

/**
 * @route   GET /api/tracking/:id/history
 * @desc    Get tracking history for a shipment
 */
const getTrackingHistory = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const { data, error } = await supabase
        .from('tracking_events')
        .select('*')
        .eq('shipment_id', id)
        .order('created_at', { ascending: true });

    if (error) throw error;

    res.json(data || []);
});

module.exports = {
    trackShipment,
    getTimeline,
    getLiveLocation,
    getDriver,
    getETA,
    getActiveShipments,
    getTrackingHistory
};
