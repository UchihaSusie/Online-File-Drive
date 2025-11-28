/**
 * Express Application Entry Point
 * 
 * This is the main Express application that handles:
 * - Metadata CRUD operations (for File Management Service)
 * - Search functionality (core feature for this service)
 * 
 * The app can run standalone (for local development) or be wrapped
 * by serverless-http for Lambda deployment.
 */

const express = require('express');
const cors = require('cors');

// Import routes
const metadataRoutes = require('./routes/metadataRoutes');
const searchRoutes = require('./routes/searchRoutes');

// Create Express app
const app = express();

// ============================================
// Middleware Configuration
// ============================================

// Enable CORS for all origins (required for browser-based clients)
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Parse JSON request bodies
app.use(express.json());

// Request logging middleware (useful for debugging)
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// ============================================
// Authentication Middleware
// ============================================
/**
 * Extract user information from JWT token in Authorization header.
 * The JWT is decoded (not verified) since Auth Service handles verification.
 * 
 * Token format: Bearer <jwt>
 * JWT payload expected: { userId: string, email: string, ... }
 */
const authMiddleware = (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Authorization header with Bearer token is required'
            });
        }

        const token = authHeader.split(' ')[1];
        
        // Decode JWT payload (base64) - not verifying since Auth Service does that
        const payload = JSON.parse(
            Buffer.from(token.split('.')[1], 'base64').toString()
        );

        // Attach user info to request object
        req.user = {
            id: payload.userId,
            email: payload.email
        };

        next();
    } catch (error) {
        console.error('Auth middleware error:', error.message);
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Invalid or malformed token'
        });
    }
};

// ============================================
// Health Check Endpoint (no auth required)
// ============================================
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'metadata-search-service',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

// ============================================
// API Routes
// ============================================

// Metadata CRUD routes - used by File Management Service
// POST   /api/metadata           - Create metadata
// GET    /api/metadata/:fileId   - Get single file metadata
// PUT    /api/metadata/:fileId   - Update metadata
// DELETE /api/metadata/:fileId   - Delete metadata
// GET    /api/metadata?userId=   - List user's files
app.use('/api/metadata', authMiddleware, metadataRoutes);

// Search routes - Core feature of this service
// GET /api/files/search?q={keyword}     - Search by keyword
// GET /api/files/search/by-type?type=   - Search by file type
// GET /api/files/search/recent          - Get recent uploads
// GET /api/files/search/stats           - Get file statistics
app.use('/api/files/search', authMiddleware, searchRoutes);

// ============================================
// Error Handling
// ============================================

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.path} not found`
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// ============================================
// Local Development Server
// ============================================
// Only start server if running directly (not imported by Lambda handler)
if (require.main === module) {
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
        console.log(`
╔═══════════════════════════════════════════════════════════╗
║           Metadata & Search Service Started               ║
╠═══════════════════════════════════════════════════════════╣
║  Server:    http://localhost:${PORT}                          ║
║  Health:    http://localhost:${PORT}/health                   ║
╠═══════════════════════════════════════════════════════════╣
║  Metadata APIs:                                           ║
║    POST   /api/metadata           - Create                ║
║    GET    /api/metadata/:fileId   - Get one               ║
║    PUT    /api/metadata/:fileId   - Update                ║
║    DELETE /api/metadata/:fileId   - Delete                ║
║    GET    /api/metadata?userId=   - List user files       ║
╠═══════════════════════════════════════════════════════════╣
║  Search APIs (Your Core Feature):                         ║
║    GET    /api/files/search?q=       - Search by keyword  ║
║    GET    /api/files/search/by-type  - Search by type     ║
║    GET    /api/files/search/recent   - Recent uploads     ║
║    GET    /api/files/search/stats    - File statistics    ║
╚═══════════════════════════════════════════════════════════╝
        `);
    });
}

module.exports = app;

