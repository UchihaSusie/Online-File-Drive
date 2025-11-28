/**
 * Metadata CRUD Routes
 * 
 * These endpoints are called by the File Management Service to manage file metadata.
 * All routes require authentication (handled by middleware in app.js).
 * 
 * Routes:
 * - POST   /api/metadata           - Create file metadata
 * - GET    /api/metadata/:fileId   - Get single file metadata
 * - PUT    /api/metadata/:fileId   - Update file metadata
 * - DELETE /api/metadata/:fileId   - Delete file metadata
 * - GET    /api/metadata?userId=   - List user's files
 */

const express = require('express');
const router = express.Router();
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { 
    DynamoDBDocumentClient, 
    PutCommand, 
    GetCommand, 
    UpdateCommand, 
    DeleteCommand,
    QueryCommand 
} = require('@aws-sdk/lib-dynamodb');

// Initialize DynamoDB client
const client = new DynamoDBClient({
    region: process.env.AWS_REGION || 'us-east-1'
});
const docClient = DynamoDBDocumentClient.from(client);

// Table name from environment variable (set by CDK)
const TABLE_NAME = process.env.TABLE_NAME || 'cloud-drive-files';

// ============================================
// POST /api/metadata - Create file metadata
// ============================================
/**
 * Create new file metadata entry.
 * Called by File Management Service after uploading file to S3.
 * 
 * Request body: {
 *   fileId, userId, filename, mimeType, size, folderId,
 *   isPublic, s3Key, s3Bucket, currentVersion, versions
 * }
 */
router.post('/', async (req, res) => {
    try {
        const {
            fileId,
            userId,
            filename,
            mimeType,
            size,
            folderId = null,
            isPublic = false,
            s3Key,
            s3Bucket,
            currentVersion = 1,
            versions = []
        } = req.body;

        // Validate required fields
        if (!fileId || !userId || !filename) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'fileId, userId, and filename are required'
            });
        }

        const timestamp = new Date().toISOString();
        
        // Create metadata object with lowercase filename for search
        const metadata = {
            fileId,
            userId,
            filename,
            filenameLower: filename.toLowerCase(), // For case-insensitive search
            mimeType: mimeType || 'application/octet-stream',
            size: size || 0,
            folderId,
            isPublic,
            s3Key: s3Key || '',
            s3Bucket: s3Bucket || '',
            currentVersion,
            versions,
            createdAt: timestamp,
            updatedAt: timestamp
        };

        // Store in DynamoDB
        await docClient.send(new PutCommand({
            TableName: TABLE_NAME,
            Item: metadata,
            // Prevent overwriting existing files
            ConditionExpression: 'attribute_not_exists(fileId)'
        }));

        console.log(`[CREATE] File metadata created: ${fileId}`);

        res.status(201).json({
            message: 'Metadata created successfully',
            metadata
        });

    } catch (error) {
        console.error('[CREATE] Error:', error);

        if (error.name === 'ConditionalCheckFailedException') {
            return res.status(409).json({
                error: 'Conflict',
                message: 'File with this ID already exists'
            });
        }

        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to create metadata'
        });
    }
});

// ============================================
// GET /api/metadata/:fileId - Get single file
// ============================================
/**
 * Retrieve metadata for a specific file.
 * Returns 404 if file not found.
 */
router.get('/:fileId', async (req, res) => {
    try {
        const { fileId } = req.params;

        const result = await docClient.send(new GetCommand({
            TableName: TABLE_NAME,
            Key: { fileId }
        }));

        if (!result.Item) {
            return res.status(404).json({
                error: 'Not Found',
                message: `File ${fileId} not found`
            });
        }

        console.log(`[GET] File metadata retrieved: ${fileId}`);

        res.json({
            message: 'Metadata retrieved successfully',
            metadata: result.Item
        });

    } catch (error) {
        console.error('[GET] Error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to retrieve metadata'
        });
    }
});

// ============================================
// PUT /api/metadata/:fileId - Update metadata
// ============================================
/**
 * Update file metadata.
 * Only updates provided fields, preserves others.
 */
router.put('/:fileId', async (req, res) => {
    try {
        const { fileId } = req.params;
        const updates = req.body;

        // Check if file exists
        const existing = await docClient.send(new GetCommand({
            TableName: TABLE_NAME,
            Key: { fileId }
        }));

        if (!existing.Item) {
            return res.status(404).json({
                error: 'Not Found',
                message: `File ${fileId} not found`
            });
        }

        // Build update expression dynamically
        const allowedFields = [
            'filename', 'mimeType', 'size', 'folderId', 'isPublic',
            's3Key', 's3Bucket', 'currentVersion', 'versions'
        ];

        let updateExpression = 'SET updatedAt = :updatedAt';
        const expressionAttributeValues = {
            ':updatedAt': new Date().toISOString()
        };
        const expressionAttributeNames = {};

        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                updateExpression += `, #${field} = :${field}`;
                expressionAttributeNames[`#${field}`] = field;
                expressionAttributeValues[`:${field}`] = updates[field];
                
                // Update lowercase filename if filename changed
                if (field === 'filename') {
                    updateExpression += ', #filenameLower = :filenameLower';
                    expressionAttributeNames['#filenameLower'] = 'filenameLower';
                    expressionAttributeValues[':filenameLower'] = updates[field].toLowerCase();
                }
            }
        }

        const result = await docClient.send(new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { fileId },
            UpdateExpression: updateExpression,
            ExpressionAttributeValues: expressionAttributeValues,
            ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 
                ? expressionAttributeNames 
                : undefined,
            ReturnValues: 'ALL_NEW'
        }));

        console.log(`[UPDATE] File metadata updated: ${fileId}`);

        res.json({
            message: 'Metadata updated successfully',
            metadata: result.Attributes
        });

    } catch (error) {
        console.error('[UPDATE] Error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to update metadata'
        });
    }
});

// ============================================
// DELETE /api/metadata/:fileId - Delete metadata
// ============================================
/**
 * Delete file metadata.
 * Note: This only removes metadata, not the actual file in S3.
 */
router.delete('/:fileId', async (req, res) => {
    try {
        const { fileId } = req.params;

        // Check if file exists before deleting
        const existing = await docClient.send(new GetCommand({
            TableName: TABLE_NAME,
            Key: { fileId }
        }));

        if (!existing.Item) {
            return res.status(404).json({
                error: 'Not Found',
                message: `File ${fileId} not found`
            });
        }

        await docClient.send(new DeleteCommand({
            TableName: TABLE_NAME,
            Key: { fileId }
        }));

        console.log(`[DELETE] File metadata deleted: ${fileId}`);

        res.json({
            message: 'Metadata deleted successfully',
            fileId
        });

    } catch (error) {
        console.error('[DELETE] Error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to delete metadata'
        });
    }
});

// ============================================
// GET /api/metadata?userId= - List user's files
// ============================================
/**
 * List all files belonging to a user.
 * Uses GSI (userId-createdAt-index) for efficient querying.
 * 
 * Query params:
 * - userId: Required. The user whose files to list.
 * - limit: Optional. Max number of results (default: 100)
 * - folderId: Optional. Filter by folder
 */
router.get('/', async (req, res) => {
    try {
        const { userId, limit = 100, folderId } = req.query;

        if (!userId) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'userId query parameter is required'
            });
        }

        // Query using GSI for efficient lookup by userId
        const params = {
            TableName: TABLE_NAME,
            IndexName: 'userId-createdAt-index',
            KeyConditionExpression: 'userId = :userId',
            ExpressionAttributeValues: {
                ':userId': userId
            },
            Limit: parseInt(limit),
            // Sort by createdAt descending (newest first)
            ScanIndexForward: false
        };

        // Add folder filter if provided
        if (folderId) {
            params.FilterExpression = 'folderId = :folderId';
            params.ExpressionAttributeValues[':folderId'] = folderId;
        }

        const result = await docClient.send(new QueryCommand(params));

        console.log(`[LIST] Retrieved ${result.Items?.length || 0} files for user: ${userId}`);

        res.json({
            message: 'Files retrieved successfully',
            files: result.Items || [],
            count: result.Items?.length || 0
        });

    } catch (error) {
        console.error('[LIST] Error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to list files'
        });
    }
});

module.exports = router;

