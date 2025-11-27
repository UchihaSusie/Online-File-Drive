const axios = require('axios');

const METADATA_SERVICE_URL = process.env.METADATA_SERVICE_URL || 'http://localhost:3001';

class MetadataClient {
    /**
     * Create file metadata
     */
    async createMetadata(metadataPayload, token) {
        try {
            const response = await axios.post(
                `${METADATA_SERVICE_URL}/api/metadata`,
                metadataPayload,
                {
                    headers: { 'Authorization': `Bearer ${token}` },
                    timeout: 5000
                }
            );
            return response.data.metadata;
        } catch (error) {
            console.error('Failed to create metadata:', error.message);
            throw new Error('Failed to create file metadata');
        }
    }

    /**
     * Get file metadata
     */
    async getMetadata(fileId, token) {
        try {
            const response = await axios.get(
                `${METADATA_SERVICE_URL}/api/metadata/${fileId}`,
                {
                    headers: { 'Authorization': `Bearer ${token}` },
                    timeout: 5000
                }
            );
            return response.data.metadata;
        } catch (error) {
            if (error.response?.status === 404) {
                const err = new Error('File not found');
                err.statusCode = 404;
                err.code = 'FILE_NOT_FOUND';
                throw err;
            }
            throw new Error('Failed to retrieve file metadata');
        }
    }

    /**
     * Update file metadata
     */
    async updateMetadata(fileId, updates, token) {
        try {
            const response = await axios.put(
                `${METADATA_SERVICE_URL}/api/metadata/${fileId}`,
                updates,
                {
                    headers: { 'Authorization': `Bearer ${token}` },
                    timeout: 5000
                }
            );
            return response.data.metadata;
        } catch (error) {
            console.error('Failed to update metadata:', error.message);
            throw new Error('Failed to update file metadata');
        }
    }

    /**
     * Delete file metadata
     */
    async deleteMetadata(fileId, token) {
        try {
            await axios.delete(
                `${METADATA_SERVICE_URL}/api/metadata/${fileId}`,
                {
                    headers: { 'Authorization': `Bearer ${token}` },
                    timeout: 5000
                }
            );
        } catch (error) {
            console.error('Failed to delete metadata:', error.message);
            throw new Error('Failed to delete file metadata');
        }
    }

    /**
     * List files by user
     */
    async listUserFiles(userId, token, folderId = null) {
        try {
            const params = { userId };
            if (folderId) params.folderId = folderId;
            
            const response = await axios.get(
                `${METADATA_SERVICE_URL}/api/metadata`,
                {
                    headers: { 'Authorization': `Bearer ${token}` },
                    params,
                    timeout: 5000
                }
            );
            return response.data.files;
        } catch (error) {
            console.error('Failed to list files:', error.message);
            throw new Error('Failed to list user files');
        }
    }
}

module.exports = new MetadataClient();