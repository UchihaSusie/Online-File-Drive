const authClient = require('../clients/authClient');

/**
 * Middleware to authenticate requests using the Auth service
 */
const authenticate = async (req, res, next) => {
    try {
        const token = extractToken(req);
        const user = await authClient.verifyToken(token);
        
        // Attach user info and token to request
        req.user = user;
        req.token = token;
        
        next();
    } catch (error) {
        console.error('Authentication failed:', error.message);
        
        if (error.message.includes('token') || error.message.includes('Unauthorized')) {
            return res.status(401).json({ 
                error: 'Invalid or expired token',
                code: 'AUTH_INVALID_TOKEN'
            });
        }
        
        return res.status(500).json({ 
            error: 'Authentication service error',
            code: 'AUTH_SERVICE_ERROR'
        });
    }
};

/**
 * Extract token from Authorization header
 */
const extractToken = (req) => {
    const authHeader = req.headers['authorization'];
    
    if (!authHeader) {
        throw new Error('No authorization header');
    }
    
    if (!authHeader.startsWith('Bearer ')) {
        throw new Error('Invalid authorization format');
    }
    
    const token = authHeader.substring(7);
    
    if (!token) {
        throw new Error('No token provided');
    }
    
    return token;
};

module.exports = {
    authenticate,
    extractToken
};