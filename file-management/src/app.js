const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const fileRoutes = require('./routes/fileRoutes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
require('dotenv').config();

const app = express();

// Security middleware
app.use(helmet());

// CORS
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Logging
if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('combined'));
}

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'file-management',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// API routes
app.use('/api/files', fileRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 3002;

// Only start server when not being imported for testing
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║   📁 File Management Service                                   ║
║                                                                ║
║   Status: RUNNING ✓                                            ║
║   Port: ${PORT}                                                     ║
║   Environment: ${process.env.NODE_ENV || 'development'}                                  ║
║   S3 Bucket: ${process.env.S3_BUCKET_NAME || 'cloud-drive-files'}                          ║
║                                                                ║
║   Endpoints:                                                   ║
║   ├─ POST   /api/files/upload                                  ║
║   ├─ PUT    /api/files/:fileId                                 ║
║   ├─ GET    /api/files/:fileId/download                        ║
║   ├─ GET    /api/files/:fileId/versions                        ║
║   ├─ POST   /api/files/:fileId/restore                         ║
║   ├─ DELETE /api/files/:fileId                                 ║
║   └─ GET    /api/files                                         ║
║                                                                ║
║   Connected Services:                                          ║
║   ├─ Auth: ${process.env.AUTH_SERVICE_URL || 'http://localhost:3000'}                      ║
║   └─ Metadata: ${process.env.METADATA_SERVICE_URL || 'http://localhost:3001'}                  ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
        `);
    });
}

module.exports = app;