const { 
    PutObjectCommand, 
    GetObjectCommand, 
    DeleteObjectCommand 
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { s3Client, S3_CONFIG } = require('../config/aws');
const metadataClient = require('../clients/metadataClient');

class FileService {
    /**
     * Generate unique file ID
     */
    generateFileId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Build S3 key for file
     */
    buildS3Key(userId, fileId, version, filename) {
        return `${userId}/${fileId}/v${version}/${filename}`;
    }

    /**
     * Upload file to S3
     */
    async uploadToS3(s3Key, buffer, mimetype, metadata) {
        try {
            const command = new PutObjectCommand({
                Bucket: S3_CONFIG.bucket,
                Key: s3Key,
                Body: buffer,
                ContentType: mimetype,
                Metadata: metadata
            });

            await s3Client.send(command);
            
            console.log(`✓ File uploaded to S3: ${s3Key}`);
        } catch (error) {
            console.error('S3 upload error:', error);
            throw new Error('Failed to upload file to storage');
        }
    }

    /**
     * Get file from S3
     */
    async getFromS3(s3Key) {
        try {
            const command = new GetObjectCommand({
                Bucket: S3_CONFIG.bucket,
                Key: s3Key
            });

            const response = await s3Client.send(command);
            return response;
        } catch (error) {
            console.error('S3 get error:', error);
            
            if (error.name === 'NoSuchKey') {
                const err = new Error('File not found in storage');
                err.statusCode = 404;
                err.code = 'FILE_NOT_FOUND';
                throw err;
            }
            
            throw new Error('Failed to retrieve file from storage');
        }
    }

    /**
     * Delete file from S3
     */
    async deleteFromS3(s3Key) {
        try {
            const command = new DeleteObjectCommand({
                Bucket: S3_CONFIG.bucket,
                Key: s3Key
            });

            await s3Client.send(command);
            
            console.log(`✓ File deleted from S3: ${s3Key}`);
        } catch (error) {
            console.error('S3 delete error:', error);
            // Don't throw error if file doesn't exist
            if (error.name !== 'NoSuchKey') {
                console.error('Failed to delete file from storage:', error.message);
            }
        }
    }

    /**
     * Generate presigned download URL
     */
    async generateDownloadUrl(s3Key, expiresIn = S3_CONFIG.presignedUrlExpiry) {
        try {
            const command = new GetObjectCommand({
                Bucket: S3_CONFIG.bucket,
                Key: s3Key
            });

            const url = await getSignedUrl(s3Client, command, { expiresIn });
            return url;
        } catch (error) {
            console.error('Error generating presigned URL:', error);
            throw new Error('Failed to generate download URL');
        }
    }

    /**
     * Stream to buffer helper
     */
    async streamToBuffer(stream) {
        const chunks = [];
        for await (const chunk of stream) {
            chunks.push(chunk);
        }
        return Buffer.concat(chunks);
    }

    /**
     * Check file ownership or public access
     */
    checkFileAccess(metadata, userId) {
        if (metadata.userId === userId) {
            return { canAccess: true, isOwner: true };
        }
        
        if (metadata.isPublic) {
            return { canAccess: true, isOwner: false };
        }
        
        return { canAccess: false, isOwner: false };
    }
}

module.exports = new FileService();