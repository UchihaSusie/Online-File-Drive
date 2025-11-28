/**
 * Search Service
 * 
 * Features:
 * 1. searchByKeyword - Search files by name (case-insensitive)
 * 2. searchByType - Filter files by type (image, video, audio, pdf, document, text)
 * 3. getRecentFiles - Get recently uploaded files
 * 4. getFileStats - Get user's file statistics
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({
    region: process.env.AWS_REGION || 'us-east-1'
});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME || 'cloud-drive-files';

/**
 * File type to MIME type prefix mapping
 */
const TYPE_MAPPING = {
    'image': ['image/'],
    'video': ['video/'],
    'audio': ['audio/'],
    'pdf': ['application/pdf'],
    'document': [
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml'
    ],
    'text': ['text/']
};

class SearchService {
    
    /**
     * Search files by keyword in filename
     * 
     * Uses DynamoDB's contains() function for substring matching
     * on the filenameLower field (case-insensitive search).
     * 
     * @param {string} userId - User ID to search within
     * @param {string} keyword - Search keyword
     * @param {number} limit - Maximum results to return
     * @returns {Object} Search results with matching files
     */
    async searchByKeyword(userId, keyword, limit = 50) {
        console.log(`[SEARCH] Keyword search: "${keyword}" for user: ${userId}`);

        // Convert keyword to lowercase for case-insensitive matching
        const keywordLower = keyword.toLowerCase();

        // Query user's files using GSI, then filter by keyword
        // DynamoDB doesn't support contains() in KeyConditionExpression,
        // so we query by userId and filter results
        const result = await docClient.send(new QueryCommand({
            TableName: TABLE_NAME,
            IndexName: 'userId-createdAt-index',
            KeyConditionExpression: 'userId = :userId',
            FilterExpression: 'contains(filenameLower, :keyword)',
            ExpressionAttributeValues: {
                ':userId': userId,
                ':keyword': keywordLower
            },
            Limit: parseInt(limit),
            ScanIndexForward: false // Newest first
        }));

        console.log(`[SEARCH] Found ${result.Items?.length || 0} files matching "${keyword}"`);

        return {
            query: keyword,
            files: result.Items || [],
            count: result.Items?.length || 0
        };
    }

    /**
     * Search files by type
     * 
     * Filters files based on their MIME type prefix.
     * Supported types: image, video, audio, pdf, document, text
     * 
     * @param {string} userId - User ID to search within
     * @param {string} type - File type to search for
     * @param {number} limit - Maximum results to return
     * @returns {Object} Search results with matching files
     */
    async searchByType(userId, type, limit = 50) {
        console.log(`[SEARCH] Type search: "${type}" for user: ${userId}`);

        // Get MIME type prefixes for the requested type
        const mimeTypePrefixes = TYPE_MAPPING[type.toLowerCase()];

        if (!mimeTypePrefixes) {
            return {
                error: 'Invalid type',
                message: `Supported types: ${Object.keys(TYPE_MAPPING).join(', ')}`,
                files: [],
                count: 0
            };
        }

        // Query user's files and filter by MIME type
        const result = await docClient.send(new QueryCommand({
            TableName: TABLE_NAME,
            IndexName: 'userId-createdAt-index',
            KeyConditionExpression: 'userId = :userId',
            ExpressionAttributeValues: {
                ':userId': userId
            },
            Limit: 500, // Get more items to filter from
            ScanIndexForward: false
        }));

        // Filter by MIME type prefix
        const filteredFiles = (result.Items || []).filter(file => {
            if (!file.mimeType) return false;
            return mimeTypePrefixes.some(prefix => 
                file.mimeType.startsWith(prefix)
            );
        }).slice(0, limit);

        console.log(`[SEARCH] Found ${filteredFiles.length} ${type} files`);

        return {
            type,
            files: filteredFiles,
            count: filteredFiles.length
        };
    }

    /**
     * Get recently uploaded files
     * 
     * Returns files uploaded within the specified number of days.
     * 
     * @param {string} userId - User ID to search within
     * @param {number} days - Number of days to look back (default: 7)
     * @param {number} limit - Maximum results to return (default: 20)
     * @returns {Object} Recent files sorted by upload date
     */
    async getRecentFiles(userId, days = 7, limit = 20) {
        console.log(`[SEARCH] Recent files: last ${days} days for user: ${userId}`);

        // Calculate cutoff date
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        const cutoffDateStr = cutoffDate.toISOString();

        // Query using GSI with createdAt filter
        const result = await docClient.send(new QueryCommand({
            TableName: TABLE_NAME,
            IndexName: 'userId-createdAt-index',
            KeyConditionExpression: 'userId = :userId AND createdAt >= :cutoffDate',
            ExpressionAttributeValues: {
                ':userId': userId,
                ':cutoffDate': cutoffDateStr
            },
            Limit: parseInt(limit),
            ScanIndexForward: false // Newest first
        }));

        console.log(`[SEARCH] Found ${result.Items?.length || 0} recent files`);

        return {
            period: `Last ${days} days`,
            cutoffDate: cutoffDateStr,
            files: result.Items || [],
            count: result.Items?.length || 0
        };
    }

    /**
     * Get file statistics for a user
     * 
     * Calculates comprehensive statistics including:
     * - Total file count
     * - Total storage size
     * - File count by type
     * - Recent uploads (last 7 days)
     * 
     * @param {string} userId - User ID to get stats for
     * @returns {Object} Comprehensive file statistics
     */
    async getFileStats(userId) {
        console.log(`[SEARCH] Getting stats for user: ${userId}`);

        // Get all user's files for statistics
        const result = await docClient.send(new QueryCommand({
            TableName: TABLE_NAME,
            IndexName: 'userId-createdAt-index',
            KeyConditionExpression: 'userId = :userId',
            ExpressionAttributeValues: {
                ':userId': userId
            },
            // Remove limit to get all files for accurate stats
            Limit: 10000
        }));

        const files = result.Items || [];

        // Calculate statistics
        const totalFiles = files.length;
        const totalSize = files.reduce((sum, file) => sum + (file.size || 0), 0);

        // Count files by type
        const typeBreakdown = {
            image: 0,
            video: 0,
            audio: 0,
            pdf: 0,
            document: 0,
            text: 0,
            other: 0
        };

        // Calculate recent uploads (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        let recentUploads = 0;

        for (const file of files) {
            // Categorize by type
            let categorized = false;
            for (const [type, prefixes] of Object.entries(TYPE_MAPPING)) {
                if (file.mimeType && prefixes.some(p => file.mimeType.startsWith(p))) {
                    typeBreakdown[type]++;
                    categorized = true;
                    break;
                }
            }
            if (!categorized) {
                typeBreakdown.other++;
            }

            // Count recent uploads
            if (file.createdAt && new Date(file.createdAt) >= sevenDaysAgo) {
                recentUploads++;
            }
        }

        console.log(`[SEARCH] Stats calculated: ${totalFiles} files, ${formatBytes(totalSize)}`);

        return {
            userId,
            totalFiles,
            totalSize,
            totalSizeFormatted: formatBytes(totalSize),
            typeBreakdown,
            recentUploads,
            lastUpdated: new Date().toISOString()
        };
    }

    /**
     * List files with sorting
     * 
     * Get user's files with flexible sorting options.
     * 
     * @param {string} userId - User ID
     * @param {Object} options - Sorting and pagination options
     * @param {string} options.sortBy - Field to sort by: 'name', 'updatedAt', 'createdAt', 'size' (default: 'updatedAt')
     * @param {string} options.sortDirection - Sort direction: 'asc' or 'desc' (default: 'desc')
     * @param {number} options.limit - Maximum results (default: 50)
     * @param {string} options.folderId - Filter by folder ID (optional)
     * @returns {Object} Sorted file list
     */
    async listFilesWithSort(userId, options = {}) {
        const {
            sortBy = 'updatedAt',
            sortDirection = 'desc',
            limit = 50,
            folderId = null
        } = options;

        console.log(`[SEARCH] List files for user: ${userId}, sortBy: ${sortBy}, direction: ${sortDirection}`);

        // Query all user's files
        const queryParams = {
            TableName: TABLE_NAME,
            IndexName: 'userId-createdAt-index',
            KeyConditionExpression: 'userId = :userId',
            ExpressionAttributeValues: {
                ':userId': userId
            },
            Limit: 1000 // Get more to sort from
        };

        const result = await docClient.send(new QueryCommand(queryParams));
        let files = result.Items || [];

        files = files.filter(file => file.type !== 'folder');

        // Filter by folderId if provided
        if (folderId) {
            if (folderId === 'root') {
                files = files.filter(file => 
                    !file.folderId || file.folderId === 'root' || file.folderId === null
                );
            } else {
                files = files.filter(file => file.folderId === folderId);
            }
        }

        // Sort files based on sortBy and sortDirection
        files = this.sortFiles(files, sortBy, sortDirection);

        // Apply limit after sorting
        files = files.slice(0, parseInt(limit));

        console.log(`[SEARCH] Returning ${files.length} sorted files`);

        return {
            files,
            count: files.length,
            sortBy,
            sortDirection
        };
    }

    /**
     * Sort files by specified field and direction
     * 
     * @param {Array} files - Array of file objects
     * @param {string} sortBy - Field to sort by
     * @param {string} direction - 'asc' or 'desc'
     * @returns {Array} Sorted files
     */
    sortFiles(files, sortBy, direction) {
        const isAsc = direction.toLowerCase() === 'asc';

        return files.sort((a, b) => {
            let valueA, valueB;

            switch (sortBy.toLowerCase()) {
                case 'name':
                case 'filename':
                    // Sort by filename (case-insensitive)
                    valueA = (a.filename || a.filenameLower || '').toLowerCase();
                    valueB = (b.filename || b.filenameLower || '').toLowerCase();
                    break;

                case 'updatedat':
                case 'updated':
                    // Sort by updated date
                    valueA = a.updatedAt || a.createdAt || '';
                    valueB = b.updatedAt || b.createdAt || '';
                    break;

                case 'createdat':
                case 'created':
                    // Sort by created date
                    valueA = a.createdAt || '';
                    valueB = b.createdAt || '';
                    break;

                case 'size':
                    // Sort by file size
                    valueA = a.size || 0;
                    valueB = b.size || 0;
                    break;

                case 'type':
                case 'mimetype':
                    // Sort by MIME type
                    valueA = a.mimeType || '';
                    valueB = b.mimeType || '';
                    break;

                default:
                    // Default to updatedAt
                    valueA = a.updatedAt || a.createdAt || '';
                    valueB = b.updatedAt || b.createdAt || '';
            }

            // Compare values
            if (valueA < valueB) return isAsc ? -1 : 1;
            if (valueA > valueB) return isAsc ? 1 : -1;
            return 0;
        });
    }

    /**
     * Search files with sorting
     * 
     * Enhanced search that supports sorting results.
     * 
     * @param {string} userId - User ID
     * @param {string} keyword - Search keyword
     * @param {Object} options - Search and sort options
     * @returns {Object} Sorted search results
     */
    async searchWithSort(userId, keyword, options = {}) {
        const {
            sortBy = 'updatedAt',
            sortDirection = 'desc',
            limit = 50
        } = options;

        console.log(`[SEARCH] Search with sort: "${keyword}", sortBy: ${sortBy}, direction: ${sortDirection}`);

        // First, get search results
        const keywordLower = keyword.toLowerCase();

        const result = await docClient.send(new QueryCommand({
            TableName: TABLE_NAME,
            IndexName: 'userId-createdAt-index',
            KeyConditionExpression: 'userId = :userId',
            FilterExpression: 'contains(filenameLower, :keyword)',
            ExpressionAttributeValues: {
                ':userId': userId,
                ':keyword': keywordLower
            },
            Limit: 500
        }));

        let files = result.Items || [];

        // Sort the results
        files = this.sortFiles(files, sortBy, sortDirection);

        // Apply limit
        files = files.slice(0, parseInt(limit));

        return {
            query: keyword,
            files,
            count: files.length,
            sortBy,
            sortDirection
        };
    }
}

/**
 * Supported sort options
 */
const SORT_OPTIONS = {
    fields: ['name', 'filename', 'updatedAt', 'updated', 'createdAt', 'created', 'size', 'type', 'mimeType'],
    directions: ['asc', 'desc']
};

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Export singleton instance and sort options
module.exports = new SearchService();
module.exports.SORT_OPTIONS = SORT_OPTIONS;

