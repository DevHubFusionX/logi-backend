const morgan = require('morgan');
const { nodeEnv } = require('../config');

/**
 * Custom request logger middleware
 * In development, uses morgan 'dev'
 * In production, could be expanded to log to a file or external service
 */
const requestLogger = () => {
    if (nodeEnv === 'development') {
        return morgan('dev');
    }

    // Custom concise production logger
    return morgan(':method :url :status :res[content-length] - :response-time ms');
};

module.exports = requestLogger;
