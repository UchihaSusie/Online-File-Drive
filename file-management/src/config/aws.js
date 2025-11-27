const { S3Client } = require('@aws-sdk/client-s3');
require('dotenv').config();

const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    } : undefined
});

const S3_CONFIG = {
    bucket: process.env.S3_BUCKET_NAME || 'cloud-drive-files',
    region: process.env.AWS_REGION || 'us-east-1',
    presignedUrlExpiry: 3600 // 1 hour
};

module.exports = {
    s3Client,
    S3_CONFIG
};