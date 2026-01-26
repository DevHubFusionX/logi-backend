module.exports = {
    port: process.env.PORT || 5000,
    nodeEnv: process.env.NODE_ENV || 'development',
    supabase: {
        url: process.env.SUPABASE_URL,
        anonKey: process.env.SUPABASE_ANON_KEY,
        serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY
    },
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',

    // Shipment status constants
    shipmentStatus: {
        PENDING: 'pending',
        PROCESSING: 'processing',
        IN_TRANSIT: 'in_transit',
        OUT_FOR_DELIVERY: 'out_for_delivery',
        DELIVERED: 'delivered',
        CANCELLED: 'cancelled',
        RETURNED: 'returned'
    },

    // User roles
    userRoles: {
        ADMIN: 'admin',
        USER: 'user',
        DRIVER: 'driver'
    },

    // Driver status
    driverStatus: {
        ACTIVE: 'active',
        INACTIVE: 'inactive',
        SUSPENDED: 'suspended',
        ON_DELIVERY: 'on_delivery'
    },

    // Ticket status
    ticketStatus: {
        OPEN: 'open',
        IN_PROGRESS: 'in_progress',
        RESOLVED: 'resolved',
        CLOSED: 'closed'
    },

    // Pagination defaults
    pagination: {
        defaultPage: 1,
        defaultLimit: 10,
        maxLimit: 100
    }
};
