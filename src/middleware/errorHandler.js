/**
 * Global Error Handler Middleware
 */
const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);

    // Default error values
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal Server Error';
    let error = err.name || 'Error';

    // Supabase specific errors
    if (err.code) {
        switch (err.code) {
            case 'PGRST116':
                statusCode = 404;
                message = 'Resource not found';
                error = 'Not Found';
                break;
            case '23505':
                statusCode = 409;
                message = 'Resource already exists';
                error = 'Conflict';
                break;
            case '23503':
                statusCode = 400;
                message = 'Referenced resource does not exist';
                error = 'Bad Request';
                break;
            case '22P02':
                statusCode = 400;
                message = 'Invalid input format';
                error = 'Bad Request';
                break;
        }
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
