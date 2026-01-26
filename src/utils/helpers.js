const config = require('../config');

/**
 * Parse pagination parameters from query
 */
const parsePagination = (query) => {
    const page = parseInt(query.page) || config.pagination.defaultPage;
    const limit = Math.min(
        parseInt(query.limit) || config.pagination.defaultLimit,
        config.pagination.maxLimit
    );
    const offset = (page - 1) * limit;

    return { page, limit, offset };
};

/**
 * Format pagination response
 */
const paginatedResponse = (data, total, page, limit) => {
    return {
        data,
        pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            hasMore: page * limit < total
        }
    };
};

/**
 * Format success response
 */
const successResponse = (data, message = 'Success') => {
    return {
        success: true,
        message,
        data
    };
};

/**
 * Clean object - remove undefined/null values
 */
const cleanObject = (obj) => {
    return Object.fromEntries(
        Object.entries(obj).filter(([_, v]) => v != null)
    );
};

/**
 * Format date for display
 */
const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

const toRad = (value) => value * Math.PI / 180;

module.exports = {
    parsePagination,
    paginatedResponse,
    successResponse,
    cleanObject,
    formatDate,
    calculateDistance
};
