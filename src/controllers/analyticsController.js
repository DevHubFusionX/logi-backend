const { supabase, supabaseAdmin } = require('../config/supabase');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * @route   GET /api/analytics/valuation
 * @desc    Get company valuation and overview
 */
const getValuation = asyncHandler(async (req, res) => {
    const { range = 'month' } = req.query;

    // Calculate date range
    const now = new Date();
    const startDate = new Date();
    if (range === 'week') startDate.setDate(now.getDate() - 7);
    else if (range === 'month') startDate.setMonth(now.getMonth() - 1);
    else if (range === 'year') startDate.setFullYear(now.getFullYear() - 1);

    // Get revenue data
    const { data: shipments } = await supabaseAdmin
        .from('shipments')
        .select('declared_value, created_at')
        .gte('created_at', startDate.toISOString())
        .eq('status', 'delivered');

    const totalRevenue = shipments?.reduce((sum, s) => sum + (s.declared_value || 0), 0) || 0;

    res.json({
        valuation: totalRevenue,
        change: 12.5, // Placeholder - would calculate from previous period
        trend: [
            { date: '2026-01-01', value: totalRevenue * 0.7 },
            { date: '2026-01-08', value: totalRevenue * 0.8 },
            { date: '2026-01-15', value: totalRevenue * 0.9 },
            { date: '2026-01-22', value: totalRevenue }
        ]
    });
});

/**
 * @route   GET /api/analytics/revenue
 * @desc    Get revenue analytics
 */
const getRevenue = asyncHandler(async (req, res) => {
    const { startDate, endDate, groupBy = 'day' } = req.query;

    let query = supabaseAdmin
        .from('shipments')
        .select('declared_value, created_at, service_type')
        .eq('status', 'delivered');

    if (startDate) query = query.gte('created_at', startDate);
    if (endDate) query = query.lte('created_at', endDate);

    const { data: shipments } = await query;

    const total = shipments?.reduce((sum, s) => sum + (s.declared_value || 0), 0) || 0;

    // Group by service type
    const byServiceType = {};
    shipments?.forEach(s => {
        const type = s.service_type || 'standard';
        byServiceType[type] = (byServiceType[type] || 0) + (s.declared_value || 0);
    });

    res.json({
        total,
        byServiceType,
        data: shipments?.map(s => ({
            date: s.created_at,
            amount: s.declared_value || 0
        })) || []
    });
});

/**
 * @route   GET /api/analytics/expenses
 * @desc    Get expense breakdown
 */
const getExpenses = asyncHandler(async (req, res) => {
    const { range = 'month' } = req.query;

    // Placeholder data - would come from an expenses table
    res.json({
        total: 45000,
        categories: [
            { name: 'Fuel', amount: 15000, percentage: 33.3 },
            { name: 'Maintenance', amount: 8000, percentage: 17.8 },
            { name: 'Salaries', amount: 12000, percentage: 26.7 },
            { name: 'Insurance', amount: 5000, percentage: 11.1 },
            { name: 'Other', amount: 5000, percentage: 11.1 }
        ]
    });
});

/**
 * @route   GET /api/analytics/profit-margin
 * @desc    Get profit margin data
 */
const getProfitMargin = asyncHandler(async (req, res) => {
    const { data: deliveredShipments } = await supabaseAdmin
        .from('shipments')
        .select('declared_value')
        .eq('status', 'delivered');

    const revenue = deliveredShipments?.reduce((sum, s) => sum + (s.declared_value || 0), 0) || 0;
    const expenses = 45000; // Placeholder
    const grossProfit = revenue - expenses;
    const margin = revenue > 0 ? (grossProfit / revenue * 100) : 0;

    res.json({
        margin: margin.toFixed(1),
        grossProfit,
        revenue,
        expenses
    });
});

/**
 * @route   GET /api/analytics/regional
 * @desc    Get regional performance data
 */
const getRegionalPerformance = asyncHandler(async (req, res) => {
    // Placeholder - would need proper regional data
    res.json([
        { region: 'North', shipments: 450, revenue: 45000, growthRate: 12.5 },
        { region: 'South', shipments: 380, revenue: 38000, growthRate: 8.2 },
        { region: 'East', shipments: 520, revenue: 52000, growthRate: 15.3 },
        { region: 'West', shipments: 290, revenue: 29000, growthRate: 5.7 }
    ]);
});

/**
 * @route   GET /api/analytics/shipments
 * @desc    Get shipment statistics
 */
const getShipmentStats = asyncHandler(async (req, res) => {
    const { range = 'month' } = req.query;

    const now = new Date();
    const startDate = new Date();
    if (range === 'week') startDate.setDate(now.getDate() - 7);
    else if (range === 'month') startDate.setMonth(now.getMonth() - 1);
    else if (range === 'year') startDate.setFullYear(now.getFullYear() - 1);

    const { data: shipments } = await supabaseAdmin
        .from('shipments')
        .select('status, sender_id')
        .gte('created_at', startDate.toISOString());

    const uniqueCustomers = new Set(shipments?.map(s => s.sender_id) || []);

    res.json({
        total: shipments?.length || 0,
        completed: shipments?.filter(s => s.status === 'delivered').length || 0,
        customers: uniqueCustomers.size,
        returns: shipments?.filter(s => s.status === 'returned').length || 0
    });
});

/**
 * @route   GET /api/analytics/errors
 * @desc    Get shipment error summary
 */
const getErrorSummary = asyncHandler(async (req, res) => {
    const { range = 'week' } = req.query;

    const { data: cancelled } = await supabaseAdmin
        .from('shipments')
        .select('cancellation_reason, created_at')
        .eq('status', 'cancelled');

    const { data: total } = await supabaseAdmin
        .from('shipments')
        .select('id', { count: 'exact' });

    const errorRate = total?.length > 0
        ? (cancelled?.length / total.length * 100).toFixed(1)
        : 0;

    res.json({
        errorRate,
        totalErrors: cancelled?.length || 0,
        data: [
            { reason: 'Address Issues', count: 5 },
            { reason: 'Customer Request', count: 8 },
            { reason: 'Delivery Failed', count: 3 },
            { reason: 'Other', count: 2 }
        ]
    });
});

/**
 * @route   GET /api/analytics/fleet-utilization
 * @desc    Get fleet utilization metrics
 */
const getFleetUtilization = asyncHandler(async (req, res) => {
    const { data: vehicles } = await supabaseAdmin
        .from('vehicles')
        .select('is_assigned, is_active');

    const total = vehicles?.length || 0;
    const utilized = vehicles?.filter(v => v.is_assigned).length || 0;
    const active = vehicles?.filter(v => v.is_active).length || 0;

    res.json({
        total,
        utilized,
        available: active - utilized,
        onRoad: utilized,
        utilizationRate: total > 0 ? (utilized / total * 100).toFixed(1) : 0
    });
});

/**
 * @route   GET /api/analytics/live-tracking
 * @desc    Get live tracking overview
 */
const getLiveTrackingOverview = asyncHandler(async (req, res) => {
    const { data: activeShipments } = await supabaseAdmin
        .from('shipments')
        .select(`
            id,
            tracking_number,
            status,
            origin,
            destination,
            driver:drivers(
                current_lat,
                current_lng
            )
        `)
        .in('status', ['in_transit', 'out_for_delivery']);

    res.json({
        activeShipments: activeShipments?.length || 0,
        shipments: activeShipments?.map(s => ({
            id: s.id,
            trackingNumber: s.tracking_number,
            status: s.status,
            origin: s.origin,
            destination: s.destination,
            location: s.driver ? {
                lat: s.driver.current_lat,
                lng: s.driver.current_lng
            } : null
        })) || []
    });
});

/**
 * @route   POST /api/analytics/reports/:type
 * @desc    Generate report
 */
const generateReport = asyncHandler(async (req, res) => {
    const { type } = req.params;
    const { startDate, endDate, format = 'pdf' } = req.body;

    // Placeholder - would generate actual report
    res.json({
        message: `${type} report generation started`,
        url: null, // Would be a download URL
        status: 'processing'
    });
});

/**
 * @route   GET /api/analytics/dashboard
 * @desc    Get dashboard summary (all key metrics)
 */
const getDashboardSummary = asyncHandler(async (req, res) => {
    // Get shipment counts
    const { data: shipments } = await supabaseAdmin
        .from('shipments')
        .select('status, declared_value, sender_id');

    // Get driver counts
    const { data: drivers } = await supabaseAdmin
        .from('drivers')
        .select('status');

    // Get user counts by role
    const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('role');

    const uniqueCustomers = new Set(shipments?.map(s => s.sender_id) || []);
    const totalRevenue = shipments?.filter(s => s.status === 'delivered').reduce((sum, s) => sum + (s.declared_value || 0), 0) || 0;

    res.json({
        shipments: {
            total: shipments?.length || 0,
            pending: shipments?.filter(s => s.status === 'pending').length || 0,
            inTransit: shipments?.filter(s => s.status === 'in_transit').length || 0,
            delivered: shipments?.filter(s => s.status === 'delivered').length || 0
        },
        drivers: {
            total: drivers?.length || 0,
            active: drivers?.filter(d => d.status === 'active').length || 0,
            onDelivery: drivers?.filter(d => d.status === 'on_delivery').length || 0
        },
        customers: uniqueCustomers.size,
        revenue: totalRevenue,
        users: profiles?.filter(p => p.role === 'user').length || 0,
        admins: profiles?.filter(p => p.role === 'admin').length || 0
    });
});

/**
 * @route   GET /api/analytics/customers
 * @desc    Get customer growth metrics
 */
const getCustomerMetrics = asyncHandler(async (req, res) => {
    const { range = 'month' } = req.query;

    const now = new Date();
    const startDate = new Date();
    if (range === 'month') startDate.setMonth(now.getMonth() - 1);

    const { data: newUsers } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('role', 'user')
        .gte('created_at', startDate.toISOString());

    const { data: allUsers } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('role', 'user');

    res.json({
        newCustomers: newUsers?.length || 0,
        totalCustomers: allUsers?.length || 0,
        churnRate: 2.5, // Placeholder
        retention: 97.5 // Placeholder
    });
});

/**
 * @route   GET /api/analytics/delivery-performance
 * @desc    Get delivery performance metrics
 */
const getDeliveryPerformance = asyncHandler(async (req, res) => {
    const { data: delivered } = await supabaseAdmin
        .from('shipments')
        .select('created_at, delivered_at, estimated_delivery')
        .eq('status', 'delivered')
        .not('delivered_at', 'is', null);

    let onTimeCount = 0;
    let totalDeliveryTime = 0;

    delivered?.forEach(s => {
        if (s.delivered_at && s.estimated_delivery) {
            if (new Date(s.delivered_at) <= new Date(s.estimated_delivery)) {
                onTimeCount++;
            }
        }
        if (s.delivered_at && s.created_at) {
            const diff = new Date(s.delivered_at) - new Date(s.created_at);
            totalDeliveryTime += diff / (1000 * 60 * 60 * 24); // Convert to days
        }
    });

    const totalDelivered = delivered?.length || 0;

    res.json({
        onTimeRate: totalDelivered > 0 ? (onTimeCount / totalDelivered * 100).toFixed(1) : 0,
        avgDeliveryTime: totalDelivered > 0 ? (totalDeliveryTime / totalDelivered).toFixed(1) : 0,
        totalDelivered
    });
});

module.exports = {
    getValuation,
    getRevenue,
    getExpenses,
    getProfitMargin,
    getRegionalPerformance,
    getShipmentStats,
    getErrorSummary,
    getFleetUtilization,
    getLiveTrackingOverview,
    generateReport,
    getDashboardSummary,
    getCustomerMetrics,
    getDeliveryPerformance
};
