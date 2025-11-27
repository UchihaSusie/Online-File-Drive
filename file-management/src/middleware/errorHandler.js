/**
 * Global error handler middleware
 */
const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);

    // Default error
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal server error';
    let code = err.code || 'INTERNAL_ERROR';

    // Handle specific error types
    if (err.name === 'ValidationError') {
        statusCode = 400;
        code = 'VALIDATION_ERROR';
    } else if (err.name === 'MulterError') {
        statusCode = 400;
        code = 'FILE_UPLOAD_ERROR';
        
        if (err.code === 'LIMIT_FILE_SIZE') {
            message = 'File size exceeds maximum allowed size';
            code = 'FILE_TOO_LARGE';
        } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            message = 'Unexpected file field';
        }
    } else if (err.code === 'ECONNREFUSED') {
        statusCode = 503;
        message = 'Service temporarily unavailable';
        code = 'SERVICE_UNAVAILABLE';
    }

    res.status(statusCode).json({
        error: message,
        code: code,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
};

/**
 * 404 handler
 */
const notFoundHandler = (req, res) => {
    res.status(404).json({
        error: 'Endpoint not found',
        code: 'NOT_FOUND',
        path: req.originalUrl
    });
};

module.exports = {
    errorHandler,
    notFoundHandler
};