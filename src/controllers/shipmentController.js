const { supabase, supabaseAdmin } = require('../config/supabase');
const { asyncHandler } = require('../middleware/errorHandler');
const { parsePagination, paginatedResponse } = require('../utils/helpers');
const { generateTrackingNumber, calculateETA } = require('../utils/trackingNumber');
const config = require('../config');
const { calculatePriceInternal } = require('./pricingController');

/**
 * @route   GET /api/shipments
 * @desc    Get all shipments with filters
 */
const getAllShipments = asyncHandler(async (req, res) => {
    const { page, limit, offset } = parsePagination(req.query);
    const { status, search, userId } = req.query;

    let query = supabaseAdmin
        .from('shipments')
        .select(`
            id, tracking_number, origin, destination, status, shipping_fee, weight, estimated_delivery, created_at, updated_at, service_type, package_type, description, receiver_name, receiver_email, receiver_phone,
            sender:profiles!shipments_sender_id_fkey(id, first_name, last_name, email),
            driver:drivers(profile:profiles(id, first_name, last_name, email, phone))
        `, { count: 'exact' });

    // Apply filters
    if (status) {
        query = query.eq('status', status);
    }
    if (search) {
        query = query.or(`tracking_number.ilike.%${search}%,receiver_name.ilike.%${search}%`);
    }
    if (userId) {
        query = query.eq('sender_id', userId);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1).order('created_at', { ascending: false });

    const { data, error, count } = await query;

    if (error) throw error;

    res.json({
        shipments: data,
        total: count,
        page,
        ...paginatedResponse(data, count, page, limit).pagination
    });
});

/**
 * @route   GET /api/shipments/:id
 * @desc    Get single shipment by ID
 */
const getShipmentById = asyncHandler(async (req, res) => {
    const { id } = req.params;

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

    if (error || !data) {
        return res.status(404).json({
            error: 'Not Found',
            message: 'Shipment not found'
        });
    }

    // Ownership check (if not admin)
    const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', req.user.id)
        .single();

    if (profile?.role === 'user' && data.sender_id !== req.user.id) {
        return res.status(403).json({
            error: 'Forbidden',
            message: 'You do not have permission to view this shipment'
        });
    }

    res.json(data);
});

const shipmentService = require('../services/shipmentService');

/**
 * @route   POST /api/shipments
 * @desc    Create new shipment
 */
const createShipment = asyncHandler(async (req, res) => {
    // Validation is now handled by express-validator middleware in routes

    // Create shipment using service
    const data = await shipmentService.createShipment(req.user.id, req.body);

    // Create initial tracking event using service
    await shipmentService.addTrackingEvent(
        data.id,
        config.shipmentStatus.PENDING,
        req.body.origin,
        'Shipment created and pending pickup'
    );

    res.status(201).json({
        message: 'Shipment created successfully',
        shipment: data
    });
});

/**
 * @route   PUT /api/shipments/:id
 * @desc    Update shipment
 */
const updateShipment = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updates = req.body;

    // Fetch shipment once with all needed fields
    const { data: shipment, error: fetchError } = await supabaseAdmin
        .from('shipments')
        .select('sender_id, status, weight, service_type')
        .eq('id', id)
        .single();

    if (fetchError || !shipment) {
        return res.status(404).json({ error: 'Not Found', message: 'Shipment not found' });
    }

    // Role-based authorization check
    if (req.userRole === 'user') {
        if (shipment.sender_id !== req.user.id) {
            return res.status(403).json({ error: 'Forbidden', message: 'You can only update your own shipments' });
        }
        if (shipment.status !== config.shipmentStatus.PENDING) {
            return res.status(400).json({ error: 'Bad Request', message: 'Only pending shipments can be modified by users' });
        }
    }

    // Convert camelCase to snake_case for database
    const dbUpdates = {};
    if (updates.status && req.userRole !== 'user') dbUpdates.status = updates.status;
    if (updates.receiverName) dbUpdates.receiver_name = updates.receiverName;
    if (updates.receiverEmail) dbUpdates.receiver_email = updates.receiverEmail;
    if (updates.receiverPhone) dbUpdates.receiver_phone = updates.receiverPhone;
    if (updates.weight || updates.cargoWeightKg) {
        dbUpdates.weight = parseFloat(updates.weight || updates.cargoWeightKg);
    }
    if (updates.origin) dbUpdates.origin = typeof updates.origin === 'object' ? `${updates.origin.address}, ${updates.origin.city}, ${updates.origin.state}` : updates.origin;
    if (updates.destination) dbUpdates.destination = typeof updates.destination === 'object' ? `${updates.destination.address}, ${updates.destination.city}, ${updates.destination.state}` : updates.destination;
    if (updates.serviceType) dbUpdates.service_type = updates.serviceType.toLowerCase();
    if (updates.packageType) dbUpdates.package_type = updates.packageType.toLowerCase();
    if (updates.description) dbUpdates.description = updates.description;
    if (updates.specialInstructions || updates.notes) dbUpdates.special_instructions = updates.specialInstructions || updates.notes;
    if (updates.dimensions) dbUpdates.dimensions = updates.dimensions;
    if (updates.declaredValue) dbUpdates.declared_value = parseFloat(updates.declaredValue);
    if (updates.driverId && req.userRole === 'admin') dbUpdates.driver_id = updates.driverId;

    // Recalculate shipping fee and ETA if weight or service type changed
    const weightChanged = updates.weight || updates.cargoWeightKg;
    if (weightChanged || updates.serviceType) {
        const newWeight = weightChanged ? parseFloat(updates.weight || updates.cargoWeightKg) : shipment.weight;
        const newServiceType = updates.serviceType || shipment.service_type;

        dbUpdates.shipping_fee = await calculatePriceInternal(newServiceType, newWeight);

        // Recalculate ETA if service type changed
        if (updates.serviceType) {
            dbUpdates.estimated_delivery = calculateETA(newServiceType);
        }
    }

    dbUpdates.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
        .from('shipments')
        .update(dbUpdates)
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;

    // If status changed, add tracking event
    if (updates.status) {
        await supabaseAdmin.from('tracking_events').insert({
            shipment_id: id,
            status: updates.status,
            location: updates.location || data.destination,
            description: updates.statusDescription || `Status updated to ${updates.status}`
        });
    }

    res.json({
        message: 'Shipment updated successfully',
        shipment: data
    });
});

/**
 * @route   DELETE /api/shipments/:id
 * @desc    Delete shipment
 */
const deleteShipment = asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Only allow deletion of pending shipments
    const { data: shipment, error: fetchError } = await supabaseAdmin
        .from('shipments')
        .select('status, sender_id')
        .eq('id', id)
        .single();

    // Check if shipment exists first
    if (fetchError || !shipment) {
        return res.status(404).json({
            error: 'Not Found',
            message: 'Shipment not found'
        });
    }

    if (shipment.sender_id !== req.user.id && req.userRole !== 'admin') {
        return res.status(403).json({
            error: 'Forbidden',
            message: 'You can only delete your own shipments'
        });
    }

    if (shipment.status !== config.shipmentStatus.PENDING) {
        return res.status(400).json({
            error: 'Cannot Delete',
            message: 'Only pending shipments can be deleted'
        });
    }

    const { error } = await supabaseAdmin
        .from('shipments')
        .delete()
        .eq('id', id);

    if (error) throw error;

    res.json({ message: 'Shipment deleted successfully' });
});

/**
 * @route   GET /api/shipments/stats
 * @desc    Get shipment statistics
 */
const getShipmentStats = asyncHandler(async (req, res) => {
    // Optimized: Use parallel count queries instead of fetching all records
    const [total, pending, inTransit, delivered, cancelled] = await Promise.all([
        supabaseAdmin.from('shipments').select('*', { count: 'exact', head: true }),
        supabaseAdmin.from('shipments').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabaseAdmin.from('shipments').select('*', { count: 'exact', head: true }).eq('status', 'in_transit'),
        supabaseAdmin.from('shipments').select('*', { count: 'exact', head: true }).eq('status', 'delivered'),
        supabaseAdmin.from('shipments').select('*', { count: 'exact', head: true }).eq('status', 'cancelled')
    ]);

    const stats = {
        total: total.count || 0,
        pending: pending.count || 0,
        inTransit: inTransit.count || 0,
        delivered: delivered.count || 0,
        cancelled: cancelled.count || 0
    };

    res.json(stats);
});

/**
 * @route   GET /api/users/:userId/shipment-stats
 * @desc    Get shipment statistics for a specific user
 */
const getUserShipmentStats = asyncHandler(async (req, res) => {
    const { userId } = req.params;

    // Optimized: Use parallel count queries instead of fetching all records
    const [total, pending, inTransit, delivered, cancelled] = await Promise.all([
        supabaseAdmin.from('shipments').select('*', { count: 'exact', head: true }).eq('sender_id', userId),
        supabaseAdmin.from('shipments').select('*', { count: 'exact', head: true }).eq('sender_id', userId).eq('status', 'pending'),
        supabaseAdmin.from('shipments').select('*', { count: 'exact', head: true }).eq('sender_id', userId).eq('status', 'in_transit'),
        supabaseAdmin.from('shipments').select('*', { count: 'exact', head: true }).eq('sender_id', userId).eq('status', 'delivered'),
        supabaseAdmin.from('shipments').select('*', { count: 'exact', head: true }).eq('sender_id', userId).eq('status', 'cancelled')
    ]);

    const stats = {
        total: total.count || 0,
        pending: pending.count || 0,
        inTransit: inTransit.count || 0,
        delivered: delivered.count || 0,
        cancelled: cancelled.count || 0,
        active: (pending.count || 0) + (inTransit.count || 0)
    };

    res.json(stats);
});

/**
 * @route   GET /api/users/:userId/shipments
 * @desc    Get shipment history for a user
 */
const getUserShipments = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { page, limit, offset } = parsePagination(req.query);

    const { data, error, count } = await supabaseAdmin
        .from('shipments')
        .select(`
            *,
            sender:profiles!shipments_sender_id_fkey(id, first_name, last_name, email, phone),
            driver:drivers(profile:profiles(id, first_name, last_name, email, phone))
        `, { count: 'exact' })
        .eq('sender_id', userId)
        .range(offset, offset + limit - 1)
        .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
        shipments: data,
        total: count,
        ...paginatedResponse(data, count, page, limit).pagination
    });
});

/**
 * @route   POST /api/shipments/:id/cancel
 * @desc    Cancel a shipment
 */
const cancelShipment = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;

    const { data: shipment } = await supabaseAdmin
        .from('shipments')
        .select('status, sender_id')
        .eq('id', id)
        .single();

    if (!shipment) {
        return res.status(404).json({
            error: 'Not Found',
            message: 'Shipment not found'
        });
    }

    // Ownership check
    if (shipment.sender_id !== req.user.id && req.userRole !== 'admin') {
        return res.status(403).json({
            error: 'Forbidden',
            message: 'You can only cancel your own shipments'
        });
    }

    if (shipment.status === 'delivered' || shipment.status === 'cancelled') {
        return res.status(400).json({
            error: 'Cannot Cancel',
            message: 'This shipment cannot be cancelled'
        });
    }

    const { data, error } = await supabaseAdmin
        .from('shipments')
        .update({
            status: config.shipmentStatus.CANCELLED,
            cancellation_reason: reason,
            updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;

    // Add tracking event
    await supabaseAdmin.from('tracking_events').insert({
        shipment_id: id,
        status: config.shipmentStatus.CANCELLED,
        description: `Shipment cancelled: ${reason || 'No reason provided'}`
    });

    res.json({
        message: 'Shipment cancelled successfully',
        shipment: data
    });
});

/**
 * @route   GET /api/shipments/:id/documents
 * @desc    Get shipment documents
 */
const getShipmentDocuments = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
        .from('shipment_documents')
        .select('*')
        .eq('shipment_id', id);

    if (error) throw error;

    res.json(data || []);
});

module.exports = {
    getAllShipments,
    getShipmentById,
    createShipment,
    updateShipment,
    deleteShipment,
    getShipmentStats,
    getUserShipments,
    getUserShipmentStats,
    cancelShipment,
    getShipmentDocuments
};
