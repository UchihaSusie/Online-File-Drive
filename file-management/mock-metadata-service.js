const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// In-memory storage for testing
const metadataStore = new Map();

// Folder in-memory storage
const folderStore = new Map();

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

// Move file to a folder
app.post('/api/files/:fileId/move', authenticate, (req, res) => {
    const { fileId } = req.params;
    const { targetFolderId } = req.body;

    const file = metadataStore.get(fileId);

    if (!file) {
        return res.status(404).json({ error: 'File not found' });
    }

    const userId = file.userId;

    // Check if target folder exists (if not root)
    if (targetFolderId !== 'root') {
        const targetFolder = folderStore.get(targetFolderId);
        if (!targetFolder) {
            return res.status(404).json({ error: 'Target folder not found' });
        }
        if (targetFolder.userId !== userId) {
            return res.status(403).json({ error: 'Cannot move file to another user\'s folder' });
        }
    }

    // Update file metadata
    file.folderId = targetFolderId;
    file.updatedAt = new Date().toISOString();
    metadataStore.set(fileId, file);

    res.json({
        message: 'File moved successfully',
        file
    });
});

// List user's files
app.get('/api/metadata', authenticate, (req, res) => {
    const { userId, folderId } = req.query;

    const files = [...metadataStore.values()]
        .filter(m => (!userId || m.userId === userId))
        .filter(m => (folderId ? m.folderId === folderId : true));

    res.json({ 
        files,
        count: files.length
    });
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

// Create folder
app.post('/api/folders', authenticate, (req, res) => {
    const payload = req.body;
    folderStore.set(payload.folderId, payload);

    res.json({ message: 'Folder created', folder: payload });
});

// Get folder info
app.get('/api/folders/:folderId/info', authenticate, (req, res) => {
    const folder = folderStore.get(req.params.folderId);
    if (!folder) return res.status(404).json({ error: 'Folder not found' });
    res.json({ folder });
});


// List all folders for a user
app.get('/api/folders', authenticate, (req, res) => {
    const { userId } = req.query;
    const folders = [...folderStore.values()].filter(f => f.userId === userId);
    res.json({ folders });
});

// Get folder content
app.get('/api/folders/:folderId', authenticate, (req, res) => {
    const { folderId } = req.params;
    const { userId } = req.query;

    const folders = [...folderStore.values()].filter(
        f => f.parentId === folderId && f.userId === userId
    );

    const files = [...metadataStore.values()].filter(
        f => f.folderId === folderId && f.userId === userId
    );

    res.json({ folders, files });
});


// Check if targetId is a descendant of folderId
function isDescendant(folderId, targetId) {
    let current = folderStore.get(targetId);
    while (current) {
        if (current.parentId === folderId) return true;
        current = folderStore.get(current.parentId);
    }
    return false;
}

// Move folder
app.post('/api/folders/:folderId/move', authenticate, (req, res) => {
    const { folderId } = req.params;
    const { targetFolderId } = req.body;

    const folder = folderStore.get(folderId);
    if (!folder) return res.status(404).json({ error: 'Folder not found' });

    const userId = folder.userId; // owner comes from folder metadata

    if (folderId === targetFolderId) {
        return res.status(400).json({ error: 'Cannot move folder into itself' });
    }

    if (isDescendant(folderId, targetFolderId)) {
        return res.status(400).json({ error: 'Cannot move folder into its child' });
    }

    // ensure target folder belongs to same user
    if (targetFolderId !== 'root') {
        const targetFolder = folderStore.get(targetFolderId);
        if (!targetFolder || targetFolder.userId !== userId) {
            return res.status(403).json({ error: 'Cannot move into a folder owned by another user' });
        }
    }

    folder.parentId = targetFolderId;
    folder.updatedAt = new Date().toISOString();
    folderStore.set(folderId, folder);

    res.json({ message: 'Folder moved' });
});

// Helper to get all descendant folder IDs
function getAllDescendants(folderId) {
    const descendants = [];

    for (const f of folderStore.values()) {
        if (f.parentId === folderId) {
            descendants.push(f.folderId, ...getAllDescendants(f.folderId));
        }
    }

    return descendants;
}

// Delete folder and its contents
app.delete('/api/folders/:folderId', authenticate, (req, res) => {
    const { folderId } = req.params;

    const all = [String(folderId), ...getAllDescendants(folderId)].map(String);

    // delete files first
    for (const file of metadataStore.values()) {
        const fileFolderId = file.folderId ? String(file.folderId) : 'root';
        if (all.includes(fileFolderId)) {
            metadataStore.delete(file.fileId);
        }
    }

    // delete folders
    for (const id of all) folderStore.delete(id);

    res.json({ message: 'Folder deleted' });
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
