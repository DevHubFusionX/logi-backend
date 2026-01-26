const { validationResult, body, param, query } = require('express-validator');

/**
 * Middleware to check validation results
 */
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: 'Validation Error',
            message: 'Invalid input data',
            details: errors.array().map(err => ({
                field: err.path,
                message: err.msg
            }))
        });
    }
    next();
};

// Common validation rules
const rules = {
    // Auth validations
    email: body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Valid email is required'),

    password: body('password')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters'),

    // User validations
    firstName: body('firstName')
        .trim()
        .notEmpty()
        .withMessage('First name is required'),

    lastName: body('lastName')
        .trim()
        .notEmpty()
        .withMessage('Last name is required'),

    phone: body('phone')
        .optional()
        .isMobilePhone()
        .withMessage('Invalid phone number'),

    // Shipment validations
    origin: body('origin')
        .notEmpty()
        .withMessage('Origin address is required'),

    destination: body('destination')
        .notEmpty()
        .withMessage('Destination address is required'),

    weight: body('weight')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Weight must be a positive number'),

    // Pagination
    page: query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer'),

    limit: query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100'),

    // ID parameter
    id: param('id')
        .isUUID()
        .withMessage('Invalid ID format'),

    // Tracking number
    trackingNumber: param('trackingNumber')
        .notEmpty()
        .withMessage('Tracking number is required')
};

// Validation chains for different routes
const validations = {
    register: [rules.email, rules.password, rules.firstName, rules.lastName],
    login: [rules.email, rules.password],
    updateProfile: [
        body('firstName').optional().trim().notEmpty(),
        body('lastName').optional().trim().notEmpty(),
        body('phone').optional()
    ],
    createShipment: [rules.origin, rules.destination],
    pagination: [rules.page, rules.limit],
    idParam: [rules.id],
    trackingNumber: [rules.trackingNumber]
};

module.exports = { validate, rules, validations };
