/**
 * Format bytes to human readable format
 */
const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

/**
 * Parse boolean from string
 */
const parseBoolean = (value) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
        return value.toLowerCase() === 'true';
    }
    return false;
};

/**
 * Create success response
 */
const successResponse = (res, statusCode, message, data) => {
    return res.status(statusCode).json({
        message,
        ...data
    });
};

/**
 * Create error response
 */
const errorResponse = (res, statusCode, message, code) => {
    return res.status(statusCode).json({
        error: message,
        code: code || 'ERROR'
    });
};

module.exports = {
    formatBytes,
    parseBoolean,
    successResponse,
    errorResponse
};