const { supabase, supabaseAdmin } = require('../config/supabase');
const { asyncHandler } = require('../middleware/errorHandler');
const { parsePagination, paginatedResponse } = require('../utils/helpers');
const config = require('../config');

/**
 * @route   GET /api/drivers
 * @desc    Get all drivers with filters
 */
const getAllDrivers = asyncHandler(async (req, res) => {
    const { page, limit, offset } = parsePagination(req.query);
    const { status, search } = req.query;

    let query = supabaseAdmin
        .from('drivers')
        .select(`
            *,
            profile:profiles!drivers_user_id_fkey(id, first_name, last_name, email, phone, avatar_url),
            vehicle:vehicles!drivers_vehicle_id_fkey(*)
        `, { count: 'exact' });

    if (status) {
        query = query.eq('status', status);
    }
    if (search) {
        query = query.or(`license_number.ilike.%${search}%`);
    }

    query = query.range(offset, offset + limit - 1).order('created_at', { ascending: false });

    const { data, error, count } = await query;

    if (error) throw error;

    res.json({
        drivers: data,
        total: count,
        ...paginatedResponse(data, count, page, limit).pagination
    });
});

/**
 * @route   GET /api/drivers/:id
 * @desc    Get driver by ID
 */
const getDriverById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const { data, error } = await supabase
        .from('drivers')
        .select(`
            *,
            profile:profiles!drivers_user_id_fkey(*),
            vehicle:vehicles!drivers_vehicle_id_fkey(*),
            current_shipments:shipments(id, tracking_number, status, destination)
        `)
        .eq('id', id)
        .single();

    if (error || !data) {
        return res.status(404).json({
            error: 'Not Found',
            message: 'Driver not found'
        });
    }

    res.json(data);
});

/**
 * @route   POST /api/drivers
 * @desc    Create new driver
 */
const createDriver = asyncHandler(async (req, res) => {
    const { userId, licenseNumber, licenseExpiry, vehicleId } = req.body;

    // Update user role to driver
    await supabaseAdmin
        .from('profiles')
        .update({ role: 'driver' })
        .eq('id', userId);

    const { data, error } = await supabaseAdmin
        .from('drivers')
        .insert({
            user_id: userId,
            license_number: licenseNumber,
            license_expiry: licenseExpiry,
            vehicle_id: vehicleId || null,
            status: config.driverStatus.ACTIVE
        })
        .select()
        .single();

    if (error) throw error;

    res.status(201).json({
        message: 'Driver created successfully',
        driver: data
    });
});

/**
 * @route   PUT /api/drivers/:id
 * @desc    Update driver
 */
const updateDriver = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { licenseNumber, licenseExpiry, status, vehicleId } = req.body;

    const updateData = {};
    if (licenseNumber) updateData.license_number = licenseNumber;
    if (licenseExpiry) updateData.license_expiry = licenseExpiry;
    if (status) updateData.status = status;
    if (vehicleId !== undefined) updateData.vehicle_id = vehicleId;
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
        .from('drivers')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;

    res.json({
        message: 'Driver updated successfully',
        driver: data
    });
});

/**
 * @route   DELETE /api/drivers/:id
 * @desc    Delete/deactivate driver
 */
const deleteDriver = asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Soft delete - just set status to inactive
    const { error } = await supabaseAdmin
        .from('drivers')
        .update({ status: config.driverStatus.INACTIVE })
        .eq('id', id);

    if (error) throw error;

    res.json({ message: 'Driver deactivated successfully' });
});

/**
 * @route   POST /api/drivers/:id/suspend
 * @desc    Suspend a driver
 */
const suspendDriver = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;

    const { data, error } = await supabaseAdmin
        .from('drivers')
        .update({
            status: config.driverStatus.SUSPENDED,
            suspension_reason: reason,
            suspended_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;

    res.json({
        message: 'Driver suspended',
        driver: data
    });
});

/**
 * @route   POST /api/drivers/:id/reactivate
 * @desc    Reactivate a suspended driver
 */
const reactivateDriver = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
        .from('drivers')
        .update({
            status: config.driverStatus.ACTIVE,
            suspension_reason: null,
            suspended_at: null
        })
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;

    res.json({
        message: 'Driver reactivated',
        driver: data
    });
});

/**
 * @route   GET /api/drivers/stats
 * @desc    Get driver statistics
 */
const getDriverStats = asyncHandler(async (req, res) => {
    const { data: drivers } = await supabaseAdmin
        .from('drivers')
        .select('status');

    const stats = {
        total: drivers?.length || 0,
        active: drivers?.filter(d => d.status === 'active').length || 0,
        onDelivery: drivers?.filter(d => d.status === 'on_delivery').length || 0,
        suspended: drivers?.filter(d => d.status === 'suspended').length || 0,
        inactive: drivers?.filter(d => d.status === 'inactive').length || 0
    };

    res.json(stats);
});

/**
 * @route   GET /api/drivers/:id/route
 * @desc    Get driver's current route
 */
const getDriverRoute = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const { data, error } = await supabase
        .from('driver_routes')
        .select('*')
        .eq('driver_id', id)
        .eq('is_active', true)
        .single();

    if (error) {
        return res.json({ route: null, message: 'No active route' });
    }

    res.json(data);
});

/**
 * @route   POST /api/drivers/:id/vehicle
 * @desc    Assign vehicle to driver
 */
const assignVehicle = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { vehicleId } = req.body;

    const { data, error } = await supabaseAdmin
        .from('drivers')
        .update({ vehicle_id: vehicleId })
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;

    // Update vehicle status
    await supabaseAdmin
        .from('vehicles')
        .update({ is_assigned: true, assigned_driver_id: id })
        .eq('id', vehicleId);

    res.json({
        message: 'Vehicle assigned successfully',
        driver: data
    });
});

/**
 * @route   GET /api/drivers/:id/performance
 * @desc    Get driver performance metrics
 */
const getDriverPerformance = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    let query = supabase
        .from('shipments')
        .select('*')
        .eq('driver_id', id);

    if (startDate) {
        query = query.gte('created_at', startDate);
    }
    if (endDate) {
        query = query.lte('created_at', endDate);
    }

    const { data: shipments } = await query;

    const delivered = shipments?.filter(s => s.status === 'delivered') || [];
    const onTime = delivered.filter(s =>
        new Date(s.delivered_at) <= new Date(s.estimated_delivery)
    );

    res.json({
        totalDeliveries: delivered.length,
        onTimeDeliveries: onTime.length,
        onTimeRate: delivered.length > 0 ? (onTime.length / delivered.length * 100).toFixed(1) : 0,
        averageDeliveryTime: 0, // Would need more data to calculate
        rating: 4.5 // Placeholder - would come from ratings table
    });
});

/**
 * @route   POST /api/drivers/:id/verify
 * @desc    Verify driver identity
 */
const verifyDriver = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
        .from('drivers')
        .update({
            is_verified: true,
            verified_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;

    res.json({
        message: 'Driver verified successfully',
        driver: data
    });
});

/**
 * @route   GET /api/vehicles/available
 * @desc    Get available vehicles
 */
const getAvailableVehicles = asyncHandler(async (req, res) => {
    const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('is_assigned', false)
        .eq('is_active', true);

    if (error) throw error;

    res.json(data || []);
});

module.exports = {
    getAllDrivers,
    getDriverById,
    createDriver,
    updateDriver,
    deleteDriver,
    suspendDriver,
    reactivateDriver,
    getDriverStats,
    getDriverRoute,
    assignVehicle,
    getDriverPerformance,
    verifyDriver,
    getAvailableVehicles
};
