const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// In-memory storage for testing
const metadataStore = new Map();

// Mock authentication middleware
const authenticate = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        return res.status(401).json({ error: 'Authorization required' });
    }
    next();
};

// Create metadata
app.post('/api/metadata', authenticate, (req, res) => {
    try {
        const metadata = req.body;
        metadataStore.set(metadata.fileId, metadata);
        
        console.log(`✓ Created metadata for file: ${metadata.fileId}`);
        
        res.status(201).json({
            message: 'Metadata created successfully',
            metadata
        });
    } catch (error) {
        console.error('Create metadata error:', error);
        res.status(500).json({ error: 'Failed to create metadata' });
    }
});

// Get metadata by fileId
app.get('/api/metadata/:fileId', authenticate, (req, res) => {
    try {
        const { fileId } = req.params;
        const metadata = metadataStore.get(fileId);
        
        if (!metadata) {
            return res.status(404).json({ error: 'File not found' });
        }
        
        res.json({
            message: 'Metadata retrieved successfully',
            metadata
        });
    } catch (error) {
        console.error('Get metadata error:', error);
        res.status(500).json({ error: 'Failed to retrieve metadata' });
    }
});

// Update metadata
app.put('/api/metadata/:fileId', authenticate, (req, res) => {
    try {
        const { fileId } = req.params;
        const metadata = metadataStore.get(fileId);
        
        if (!metadata) {
            return res.status(404).json({ error: 'File not found' });
        }
        
        const updatedMetadata = { ...metadata, ...req.body, updatedAt: new Date().toISOString() };
        metadataStore.set(fileId, updatedMetadata);
        
        console.log(`✓ Updated metadata for file: ${fileId}`);
        
        res.json({
            message: 'Metadata updated successfully',
            metadata: updatedMetadata
        });
    } catch (error) {
        console.error('Update metadata error:', error);
        res.status(500).json({ error: 'Failed to update metadata' });
    }
});

// Delete metadata
app.delete('/api/metadata/:fileId', authenticate, (req, res) => {
    try {
        const { fileId } = req.params;
        const metadata = metadataStore.get(fileId);
        
        if (!metadata) {
            return res.status(404).json({ error: 'File not found' });
        }
        
        metadataStore.delete(fileId);
        
        console.log(`✓ Deleted metadata for file: ${fileId}`);
        
        res.json({
            message: 'Metadata deleted successfully'
        });
    } catch (error) {
        console.error('Delete metadata error:', error);
        res.status(500).json({ error: 'Failed to delete metadata' });
    }
});

// List user's files
app.get('/api/metadata', authenticate, (req, res) => {
    try {
        const { userId } = req.query;
        
        const files = Array.from(metadataStore.values())
            .filter(m => !userId || m.userId === userId);
        
        res.json({
            message: 'Metadata retrieved successfully',
            files,
            count: files.length
        });
    } catch (error) {
        console.error('List metadata error:', error);
        res.status(500).json({ error: 'Failed to list metadata' });
    }
});

// Update storage usage
app.post('/api/metadata/storage/update', authenticate, (req, res) => {
    try {
        console.log('✓ Storage update request received');
        res.json({ message: 'Storage updated successfully' });
    } catch (error) {
        console.error('Update storage error:', error);
        res.status(500).json({ error: 'Failed to update storage' });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'mock-metadata',
        files: metadataStore.size,
        timestamp: new Date().toISOString()
    });
});

const PORT = process.env.METADATA_PORT || 3001;

app.listen(PORT, () => {
    console.log(`
    ═══════════════════════════════════════════
    📝 Mock Metadata Service Running!
    ═══════════════════════════════════════════
    Server: http://localhost:${PORT}
    Storage: In-Memory (for testing)
    
    Endpoints:
       - POST   /api/metadata
       - GET    /api/metadata/:fileId
       - PUT    /api/metadata/:fileId
       - DELETE /api/metadata/:fileId
       - GET    /api/metadata (list)
       - POST   /api/metadata/storage/update
    
    Note: Data will be lost on restart
    ═══════════════════════════════════════════
    `);
});

module.exports = app;
