/**
 * Global Error Handler Middleware
 */
const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);

    // Default error values
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal Server Error';
    let error = err.name || 'Error';

    // Supabase / Postgres specific errors
    if (err.code) {
        switch (err.code) {
            case 'PGRST116':
                statusCode = 404;
                message = 'Resource not found';
                error = 'Not Found';
                break;
            case '23505': // Unique violation
                statusCode = 409;
                message = 'A record with this data already exists';
                error = 'Conflict';
                break;
            case '23503': // Foreign key violation
                statusCode = 400;
                message = 'This operation refers to a resource that does not exist';
                error = 'Bad Request';
                break;
            case '23502': // Not null violation
                statusCode = 400;
                message = 'Missing required fields in database operation';
                error = 'Bad Request';
                break;
            case '22P02': // Invalid text representation
                statusCode = 400;
                message = 'Invalid data format provided';
                error = 'Bad Request';
                break;
            case '42P01': // Undefined table
                statusCode = 500;
                message = 'Server configuration error: Database table missing';
                error = 'Database Error';
                break;
        }
    }

    // JWT / Auth Errors
    if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        message = 'Invalid token. Please log in again.';
        error = 'Unauthorized';
    } else if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        message = 'Session expired. Please log in again.';
        error = 'Unauthorized';
    }

    // Validation errors
    if (err.name === 'ValidationError') {
        statusCode = 400;
        error = 'Validation Error';
    }

    // Response object
    const response = {
        error,
        message,
        ...(process.env.NODE_ENV === 'development' && {
            stack: err.stack,
            details: err.details || null
        })
    };

    res.status(statusCode).json(response);
};

/**
 * Async handler wrapper to catch errors in async routes
 */
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Custom error class for API errors
 */
class ApiError extends Error {
    constructor(statusCode, message, details = null) {
        super(message);
        this.statusCode = statusCode;
        this.details = details;
        this.name = 'ApiError';
    }
}

module.exports = errorHandler;
module.exports.asyncHandler = asyncHandler;
module.exports.ApiError = ApiError;
