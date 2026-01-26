const { v4: uuidv4 } = require('uuid');

/**
 * Generate a unique tracking number
 * Format: BLY-YYYYMMDD-XXXXX (e.g., BLY-20260124-A7B3C)
 */
const generateTrackingNumber = () => {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const uniquePart = uuidv4().slice(0, 5).toUpperCase();
    return `BLY-${dateStr}-${uniquePart}`;
};

/**
 * Calculate estimated delivery date based on service type
 */
const calculateETA = (serviceType = 'standard') => {
    const now = new Date();
    const daysToAdd = {
        express: 1,
        priority: 2,
        standard: 5,
        economy: 7
    };

    const days = daysToAdd[serviceType] || 5;
    now.setDate(now.getDate() + days);
    return now.toISOString();
};

module.exports = { generateTrackingNumber, calculateETA };
