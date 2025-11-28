/**
 * Seed Test Data Script
 * 
 * This script populates the DynamoDB table with sample file metadata
 * for testing the Search functionality.
 * 
 * Usage:
 *   1. Replace YOUR_USER_ID with your actual user ID
 *   2. Run: node scripts/seed-test-data.js
 * 
 * Prerequisites:
 *   - AWS credentials configured
 *   - DynamoDB table 'cloud-drive-files' exists
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

// ============================================
// CONFIGURATION - REPLACE THIS WITH YOUR USER ID
// ============================================
const USER_ID = 'mih39zds27i6qt03ttq'; // <-- Replace with your actual user ID from Auth Service

const TABLE_NAME = process.env.TABLE_NAME || 'cloud-drive-files';
const REGION = process.env.AWS_REGION || 'us-east-1';

// Initialize DynamoDB client
const client = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(client);

/**
 * Sample test files with various types and dates
 */
const generateTestFiles = (userId) => {
  const now = new Date();
  
  return [
    // Images
    {
      fileId: uuidv4(),
      userId,
      filename: 'vacation-photo-2024.jpg',
      filenameLower: 'vacation-photo-2024.jpg',
      mimeType: 'image/jpeg',
      size: 2500000,
      folderId: 'photos',
      isPublic: false,
      s3Key: `${userId}/photos/vacation-photo-2024.jpg`,
      s3Bucket: 'cloud-drive-files',
      currentVersion: 1,
      versions: [],
      createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
      updatedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      fileId: uuidv4(),
      userId,
      filename: 'profile-picture.png',
      filenameLower: 'profile-picture.png',
      mimeType: 'image/png',
      size: 500000,
      folderId: null,
      isPublic: true,
      s3Key: `${userId}/profile-picture.png`,
      s3Bucket: 'cloud-drive-files',
      currentVersion: 2,
      versions: [{ version: 1, s3Key: `${userId}/profile-picture-v1.png` }],
      createdAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
      updatedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      fileId: uuidv4(),
      userId,
      filename: 'screenshot-2024.png',
      filenameLower: 'screenshot-2024.png',
      mimeType: 'image/png',
      size: 1200000,
      folderId: 'screenshots',
      isPublic: false,
      s3Key: `${userId}/screenshots/screenshot-2024.png`,
      s3Bucket: 'cloud-drive-files',
      currentVersion: 1,
      versions: [],
      createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
      updatedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    },

    // Documents
    {
      fileId: uuidv4(),
      userId,
      filename: 'Quarterly-Report-Q4.pdf',
      filenameLower: 'quarterly-report-q4.pdf',
      mimeType: 'application/pdf',
      size: 3500000,
      folderId: 'work',
      isPublic: false,
      s3Key: `${userId}/work/Quarterly-Report-Q4.pdf`,
      s3Bucket: 'cloud-drive-files',
      currentVersion: 1,
      versions: [],
      createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
      updatedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      fileId: uuidv4(),
      userId,
      filename: 'project-proposal.docx',
      filenameLower: 'project-proposal.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: 150000,
      folderId: 'work',
      isPublic: false,
      s3Key: `${userId}/work/project-proposal.docx`,
      s3Bucket: 'cloud-drive-files',
      currentVersion: 3,
      versions: [
        { version: 1, s3Key: `${userId}/work/project-proposal-v1.docx` },
        { version: 2, s3Key: `${userId}/work/project-proposal-v2.docx` },
      ],
      createdAt: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days ago
      updatedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      fileId: uuidv4(),
      userId,
      filename: 'budget-spreadsheet.xlsx',
      filenameLower: 'budget-spreadsheet.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      size: 250000,
      folderId: 'work',
      isPublic: false,
      s3Key: `${userId}/work/budget-spreadsheet.xlsx`,
      s3Bucket: 'cloud-drive-files',
      currentVersion: 1,
      versions: [],
      createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
      updatedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    },

    // Videos
    {
      fileId: uuidv4(),
      userId,
      filename: 'meeting-recording.mp4',
      filenameLower: 'meeting-recording.mp4',
      mimeType: 'video/mp4',
      size: 150000000,
      folderId: 'videos',
      isPublic: false,
      s3Key: `${userId}/videos/meeting-recording.mp4`,
      s3Bucket: 'cloud-drive-files',
      currentVersion: 1,
      versions: [],
      createdAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString(), // 4 days ago
      updatedAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    },

    // Audio
    {
      fileId: uuidv4(),
      userId,
      filename: 'podcast-episode-42.mp3',
      filenameLower: 'podcast-episode-42.mp3',
      mimeType: 'audio/mpeg',
      size: 45000000,
      folderId: 'audio',
      isPublic: true,
      s3Key: `${userId}/audio/podcast-episode-42.mp3`,
      s3Bucket: 'cloud-drive-files',
      currentVersion: 1,
      versions: [],
      createdAt: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString(), // 6 days ago
      updatedAt: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    },

    // Text files
    {
      fileId: uuidv4(),
      userId,
      filename: 'notes.txt',
      filenameLower: 'notes.txt',
      mimeType: 'text/plain',
      size: 5000,
      folderId: null,
      isPublic: false,
      s3Key: `${userId}/notes.txt`,
      s3Bucket: 'cloud-drive-files',
      currentVersion: 1,
      versions: [],
      createdAt: new Date().toISOString(), // Today
      updatedAt: new Date().toISOString(),
    },
    {
      fileId: uuidv4(),
      userId,
      filename: 'todo-list.txt',
      filenameLower: 'todo-list.txt',
      mimeType: 'text/plain',
      size: 2000,
      folderId: null,
      isPublic: false,
      s3Key: `${userId}/todo-list.txt`,
      s3Bucket: 'cloud-drive-files',
      currentVersion: 1,
      versions: [],
      createdAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
      updatedAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];
};

/**
 * Insert test data into DynamoDB
 */
async function seedData() {
  // Validate user ID
  if (USER_ID === 'YOUR_USER_ID') {
    console.error('❌ Error: Please replace YOUR_USER_ID with your actual user ID');
    console.log('\nEdit this file and update the USER_ID constant at line 20');
    console.log('You can get your user ID from the Auth Service after logging in.');
    process.exit(1);
  }

  console.log('🌱 Seeding test data...');
  console.log(`   Table: ${TABLE_NAME}`);
  console.log(`   User ID: ${USER_ID}`);
  console.log(`   Region: ${REGION}`);
  console.log('');

  const testFiles = generateTestFiles(USER_ID);

  // Insert files one by one (more reliable than batch write for debugging)
  let successCount = 0;
  let errorCount = 0;

  for (const file of testFiles) {
    try {
      await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: file,
      }));
      console.log(`   ✓ Added: ${file.filename} (${file.mimeType})`);
      successCount++;
    } catch (error) {
      console.error(`   ✗ Failed: ${file.filename} - ${error.message}`);
      errorCount++;
    }
  }

  console.log('');
  console.log('════════════════════════════════════════════');
  console.log(`  Seeding Complete!`);
  console.log(`  ✓ Success: ${successCount} files`);
  if (errorCount > 0) {
    console.log(`  ✗ Errors: ${errorCount} files`);
  }
  console.log('════════════════════════════════════════════');
  console.log('');
  console.log('Now you can test the Search APIs:');
  console.log('  - Search by keyword: GET /api/files/search?q=report');
  console.log('  - Search by type: GET /api/files/search/by-type?type=image');
  console.log('  - Recent files: GET /api/files/search/recent?days=7');
  console.log('  - Statistics: GET /api/files/search/stats');
}

// Run the seed function
seedData().catch(error => {
  console.error('Seed failed:', error);
  process.exit(1);
});

