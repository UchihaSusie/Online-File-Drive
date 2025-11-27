const axios = require('axios');

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3000';

class AuthClient {
    /**
     * Verify JWT token and get user info
     */
    async verifyToken(token) {
        try {
            const response = await axios.get(`${AUTH_SERVICE_URL}/api/auth/profile`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                timeout: 5000
            });
            
            return response.data.user;
        } catch (error) {
            if (error.response?.status === 401 || error.response?.status === 403) {
                throw new Error('Invalid or expired token');
            }
            if (error.code === 'ECONNREFUSED') {
                throw new Error('Auth service unavailable');
            }
            throw new Error('Authentication failed');
        }
    }

    /**
     * Check if user has enough storage quota
     */
    async checkStorageQuota(token, requiredSpace) {
        try {
            const user = await this.verifyToken(token);
            
            const availableSpace = user.storageQuota - user.storageUsed;
            
            if (availableSpace < requiredSpace) {
                const error = new Error(
                    `Insufficient storage. Available: ${this.formatBytes(availableSpace)}, Required: ${this.formatBytes(requiredSpace)}`
                );
                error.code = 'INSUFFICIENT_STORAGE';
                error.statusCode = 413;
                throw error;
            }
            
            return {
                userId: user.id,
                availableSpace,
                storageQuota: user.storageQuota,
                storageUsed: user.storageUsed
            };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Format bytes to human readable format
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }
}

module.exports = new AuthClient();