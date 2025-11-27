const express = require('express');
const multer = require('multer');
const { authenticate } = require('../middleware/auth');
const fileService = require('../services/fileService');
const versionService = require('../services/versionService');
const authClient = require('../clients/authClient');
const metadataClient = require('../clients/metadataClient');
const { validateUpload, validateVersionParam } = require('../utils/validators');
const { parseBoolean, successResponse, errorResponse } = require('../utils/helpers');
const { S3_CONFIG } = require('../config/aws');

const router = express.Router();

// Configure multer
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 100 * 1024 * 1024 // 100MB
    }
});

/**
 * Upload file
 * POST /api/files/upload
 */
router.post('/upload', authenticate, upload.single('file'), async (req, res, next) => {
    try {
        // Validate file
        if (!req.file) {
            return errorResponse(res, 400, 'No file provided', 'NO_FILE');
        }

        // Validate request body
        const { error } = validateUpload(req.body);
        if (error) {
            return errorResponse(res, 400, error.details[0].message, 'VALIDATION_ERROR');
        }

        const { originalname, buffer, mimetype, size } = req.file;
        const { folderId } = req.body;
        const isPublic = parseBoolean(req.body.isPublic);

        // Check storage quota
        await authClient.checkStorageQuota(req.token, size);

        // Generate file ID and S3 key
        const fileId = fileService.generateFileId();
        const s3Key = fileService.buildS3Key(req.user.id, fileId, 1, originalname);

        // Upload to S3
        await fileService.uploadToS3(s3Key, buffer, mimetype, {
            userId: req.user.id,
            originalName: originalname,
            fileId: fileId,
            version: '1'
        });

        // Create metadata
        const metadataPayload = {
            fileId,
            userId: req.user.id,
            filename: originalname,
            mimeType: mimetype,
            size,
            s3Key,
            s3Bucket: S3_CONFIG.bucket,
            folderId: folderId || null,
            isPublic,
            currentVersion: 1,
            versions: [
                versionService.createVersionMetadata(1, s3Key, size)
            ],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        await metadataClient.createMetadata(metadataPayload, req.token);

        successResponse(res, 201, 'File uploaded successfully', {
            file: {
                fileId,
                filename: originalname,
                size,
                mimeType: mimetype,
                currentVersion: 1
            }
        });

    } catch (error) {
        next(error);
    }
});

/**
 * Update file (create new version)
 * PUT /api/files/:fileId
 */
router.put('/:fileId', authenticate, upload.single('file'), async (req, res, next) => {
    try {
        const { fileId } = req.params;

        // Validate file
        if (!req.file) {
            return errorResponse(res, 400, 'No file provided', 'NO_FILE');
        }

        const { originalname, buffer, mimetype, size } = req.file;

        // Get current metadata
        const metadata = await metadataClient.getMetadata(fileId, req.token);

        // Check ownership
        if (metadata.userId !== req.user.id) {
            return errorResponse(res, 403, 'Access denied', 'ACCESS_DENIED');
        }

        // Check storage quota (only if file is larger)
        const sizeDifference = size - metadata.size;
        if (sizeDifference > 0) {
            await authClient.checkStorageQuota(req.token, sizeDifference);
        }

        // Calculate new version
        const newVersion = metadata.currentVersion + 1;
        const s3Key = fileService.buildS3Key(req.user.id, fileId, newVersion, originalname);

        // Upload new version to S3
        await fileService.uploadToS3(s3Key, buffer, mimetype, {
            userId: req.user.id,
            originalName: originalname,
            fileId: fileId,
            version: newVersion.toString()
        });

        // Manage versions
        const { versionsToKeep, deletedVersion } = versionService.addVersion(
            metadata.versions,
            versionService.createVersionMetadata(newVersion, s3Key, size)
        );

        // Delete oldest version if necessary
        await versionService.deleteOldVersion(deletedVersion);

        // Update metadata
        const updatedMetadata = {
            filename: originalname,
            mimeType: mimetype,
            size,
            s3Key,
            currentVersion: newVersion,
            versions: versionsToKeep,
            updatedAt: new Date().toISOString()
        };

        await metadataClient.updateMetadata(fileId, updatedMetadata, req.token);

        const responseMessage = deletedVersion 
            ? `File updated successfully. Version ${deletedVersion.version} was removed due to version limit (max 3 versions)` 
            : 'File updated successfully';

        successResponse(res, 200, responseMessage, {
            file: {
                fileId,
                filename: originalname,
                size,
                mimeType: mimetype,
                currentVersion: newVersion,
                totalVersions: versionsToKeep.length
            }
        });

    } catch (error) {
        next(error);
    }
});

/**
 * Download file
 * GET /api/files/:fileId/download
 */
router.get('/:fileId/download', authenticate, async (req, res, next) => {
    try {
        const { fileId } = req.params;
        const { version } = req.query;

        // Validate version parameter
        const { error: versionError } = validateVersionParam(version);
        if (versionError) {
            return errorResponse(res, 400, versionError.message, 'INVALID_VERSION');
        }

        // Get metadata
        const metadata = await metadataClient.getMetadata(fileId, req.token);

        // Check access permissions
        const { canAccess } = fileService.checkFileAccess(metadata, req.user.id);
        if (!canAccess) {
            return errorResponse(res, 403, 'Access denied', 'ACCESS_DENIED');
        }

        // Find requested version
        let s3Key = metadata.s3Key;
        let versionNumber = metadata.currentVersion;
        let versionSize = metadata.size;

        if (version) {
            const requestedVersion = versionService.findVersion(metadata.versions, version);
            if (!requestedVersion) {
                return errorResponse(res, 404, 'Version not found', 'VERSION_NOT_FOUND');
            }
            s3Key = requestedVersion.s3Key;
            versionNumber = requestedVersion.version;
            versionSize = requestedVersion.size;
        }

        // Generate presigned URL
        const downloadUrl = await fileService.generateDownloadUrl(s3Key);

        successResponse(res, 200, 'Download URL generated', {
            downloadUrl,
            filename: metadata.filename,
            version: versionNumber,
            size: versionSize,
            expiresIn: S3_CONFIG.presignedUrlExpiry
        });

    } catch (error) {
        next(error);
    }
});

/**
 * Get file versions
 * GET /api/files/:fileId/versions
 */
router.get('/:fileId/versions', authenticate, async (req, res, next) => {
    try {
        const { fileId } = req.params;

        // Get metadata
        const metadata = await metadataClient.getMetadata(fileId, req.token);

        // Check access permissions
        const { canAccess } = fileService.checkFileAccess(metadata, req.user.id);
        if (!canAccess) {
            return errorResponse(res, 403, 'Access denied', 'ACCESS_DENIED');
        }

        // Format versions for response
        const formattedVersions = versionService.formatVersionsResponse(
            metadata.versions,
            metadata.currentVersion
        );

        successResponse(res, 200, 'Versions retrieved successfully', {
            fileId,
            filename: metadata.filename,
            currentVersion: metadata.currentVersion,
            versions: formattedVersions
        });

    } catch (error) {
        next(error);
    }
});

/**
 * Delete file
 * DELETE /api/files/:fileId
 */
router.delete('/:fileId', authenticate, async (req, res, next) => {
    try {
        const { fileId } = req.params;

        // Get metadata
        const metadata = await metadataClient.getMetadata(fileId, req.token);

        // Check ownership
        if (metadata.userId !== req.user.id) {
            return errorResponse(res, 403, 'Access denied', 'ACCESS_DENIED');
        }

        // Delete all versions from S3
        for (const version of metadata.versions) {
            await fileService.deleteFromS3(version.s3Key);
        }

        // Delete metadata
        await metadataClient.deleteMetadata(fileId, req.token);

        successResponse(res, 200, 'File and all versions deleted successfully', {
            deletedVersions: metadata.versions.length
        });

    } catch (error) {
        next(error);
    }
});

/**
 * List user's files
 * GET /api/files
 */
router.get('/', authenticate, async (req, res, next) => {
    try {
        const { folderId } = req.query;

        const result = await metadataClient.listUserFiles(
            req.user.id,
            req.token,
            folderId
        );

        successResponse(res, 200, 'Files retrieved successfully', result);

    } catch (error) {
        next(error);
    }
});

module.exports = router;