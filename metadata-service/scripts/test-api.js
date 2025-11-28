/**
 * API Test Script
 * 
 * Tests all API endpoints of the Metadata + Search Service.
 * 
 * Usage:
 *   1. Set API_URL to your deployed API Gateway URL or local server
 *   2. Set AUTH_TOKEN to a valid JWT token from Auth Service
 *   3. Run: node scripts/test-api.js
 * 
 * For local testing:
 *   API_URL=http://localhost:3001 AUTH_TOKEN=xxx node scripts/test-api.js
 */

const https = require('https');
const http = require('http');

// ============================================
// CONFIGURATION
// ============================================

// API URL - replace with your deployed API Gateway URL
const API_URL = process.env.API_URL || 'http://localhost:3001';

// JWT Token - get this from Auth Service after login
// Format: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
const AUTH_TOKEN = process.env.AUTH_TOKEN || 'YOUR_JWT_TOKEN';

// Test user ID (should match the token's userId)
const TEST_USER_ID = process.env.USER_ID || 'test-user-123';

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
};

/**
 * Make HTTP request
 */
async function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_URL + path);
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`,
      },
    };

    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: JSON.parse(data),
          });
        } catch {
          resolve({
            status: res.statusCode,
            data: data,
          });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

/**
 * Test result logger
 */
function logResult(testName, passed, details = '') {
  const status = passed 
    ? `${colors.green}✓ PASS${colors.reset}` 
    : `${colors.red}✗ FAIL${colors.reset}`;
  console.log(`  ${status} ${testName}`);
  if (details && !passed) {
    console.log(`         ${colors.yellow}${details}${colors.reset}`);
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('         Metadata + Search Service API Tests');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  API URL: ${API_URL}`);
  console.log(`  User ID: ${TEST_USER_ID}`);
  console.log('');

  // Validate token
  if (AUTH_TOKEN === 'YOUR_JWT_TOKEN') {
    console.log(`${colors.red}❌ Error: Please set AUTH_TOKEN environment variable${colors.reset}`);
    console.log('');
    console.log('Get a token by logging into the Auth Service:');
    console.log('  curl -X POST http://localhost:3000/api/auth/login \\');
    console.log('    -H "Content-Type: application/json" \\');
    console.log('    -d \'{"email":"your@email.com","password":"yourpassword"}\'');
    console.log('');
    console.log('Then run:');
    console.log(`  AUTH_TOKEN=<your-token> node scripts/test-api.js`);
    process.exit(1);
  }

  let passed = 0;
  let failed = 0;
  let testFileId = null;

  // ============================================
  // Health Check Tests
  // ============================================
  console.log(`${colors.blue}[Health Check]${colors.reset}`);
  
  try {
    const res = await request('GET', '/health');
    const success = res.status === 200 && res.data.status === 'healthy';
    logResult('GET /health', success, `Status: ${res.status}`);
    success ? passed++ : failed++;
  } catch (error) {
    logResult('GET /health', false, error.message);
    failed++;
  }

  console.log('');

  // ============================================
  // Metadata CRUD Tests
  // ============================================
  console.log(`${colors.blue}[Metadata CRUD]${colors.reset}`);

  // Create metadata
  try {
    const createBody = {
      fileId: `test-file-${Date.now()}`,
      userId: TEST_USER_ID,
      filename: 'test-document.pdf',
      mimeType: 'application/pdf',
      size: 1024000,
      folderId: 'test-folder',
      isPublic: false,
      s3Key: `${TEST_USER_ID}/test-document.pdf`,
      s3Bucket: 'cloud-drive-files',
    };
    
    const res = await request('POST', '/api/metadata', createBody);
    const success = res.status === 201 && res.data.metadata;
    testFileId = createBody.fileId;
    logResult('POST /api/metadata (create)', success, `Status: ${res.status}`);
    success ? passed++ : failed++;
  } catch (error) {
    logResult('POST /api/metadata (create)', false, error.message);
    failed++;
  }

  // Get metadata
  if (testFileId) {
    try {
      const res = await request('GET', `/api/metadata/${testFileId}`);
      const success = res.status === 200 && res.data.metadata;
      logResult('GET /api/metadata/:fileId (get one)', success, `Status: ${res.status}`);
      success ? passed++ : failed++;
    } catch (error) {
      logResult('GET /api/metadata/:fileId (get one)', false, error.message);
      failed++;
    }
  }

  // Update metadata
  if (testFileId) {
    try {
      const res = await request('PUT', `/api/metadata/${testFileId}`, {
        filename: 'updated-document.pdf',
        size: 2048000,
      });
      const success = res.status === 200 && res.data.metadata?.filename === 'updated-document.pdf';
      logResult('PUT /api/metadata/:fileId (update)', success, `Status: ${res.status}`);
      success ? passed++ : failed++;
    } catch (error) {
      logResult('PUT /api/metadata/:fileId (update)', false, error.message);
      failed++;
    }
  }

  // List files
  try {
    const res = await request('GET', `/api/metadata?userId=${TEST_USER_ID}`);
    const success = res.status === 200 && Array.isArray(res.data.files);
    logResult('GET /api/metadata?userId= (list)', success, `Status: ${res.status}, Files: ${res.data.files?.length || 0}`);
    success ? passed++ : failed++;
  } catch (error) {
    logResult('GET /api/metadata?userId= (list)', false, error.message);
    failed++;
  }

  console.log('');

  // ============================================
  // Search API Tests
  // ============================================
  console.log(`${colors.blue}[Search APIs]${colors.reset}`);

  // Search by keyword
  try {
    const res = await request('GET', '/api/files/search?q=document');
    const success = res.status === 200 && Array.isArray(res.data.files);
    logResult('GET /api/files/search?q= (keyword search)', success, `Status: ${res.status}, Results: ${res.data.files?.length || 0}`);
    success ? passed++ : failed++;
  } catch (error) {
    logResult('GET /api/files/search?q= (keyword search)', false, error.message);
    failed++;
  }

  // Search by type
  try {
    const res = await request('GET', '/api/files/search/by-type?type=pdf');
    const success = res.status === 200 && Array.isArray(res.data.files);
    logResult('GET /api/files/search/by-type?type= (type search)', success, `Status: ${res.status}, Results: ${res.data.files?.length || 0}`);
    success ? passed++ : failed++;
  } catch (error) {
    logResult('GET /api/files/search/by-type?type= (type search)', false, error.message);
    failed++;
  }

  // Recent files
  try {
    const res = await request('GET', '/api/files/search/recent?days=7&limit=10');
    const success = res.status === 200 && Array.isArray(res.data.files);
    logResult('GET /api/files/search/recent (recent files)', success, `Status: ${res.status}, Results: ${res.data.files?.length || 0}`);
    success ? passed++ : failed++;
  } catch (error) {
    logResult('GET /api/files/search/recent (recent files)', false, error.message);
    failed++;
  }

  // File stats
  try {
    const res = await request('GET', '/api/files/search/stats');
    const success = res.status === 200 && res.data.stats;
    logResult('GET /api/files/search/stats (statistics)', success, `Status: ${res.status}, Total files: ${res.data.stats?.totalFiles || 0}`);
    success ? passed++ : failed++;
  } catch (error) {
    logResult('GET /api/files/search/stats (statistics)', false, error.message);
    failed++;
  }

  console.log('');

  // ============================================
  // Cleanup - Delete test file
  // ============================================
  console.log(`${colors.blue}[Cleanup]${colors.reset}`);

  if (testFileId) {
    try {
      const res = await request('DELETE', `/api/metadata/${testFileId}`);
      const success = res.status === 200;
      logResult('DELETE /api/metadata/:fileId (cleanup)', success, `Status: ${res.status}`);
      success ? passed++ : failed++;
    } catch (error) {
      logResult('DELETE /api/metadata/:fileId (cleanup)', false, error.message);
      failed++;
    }
  }

  // ============================================
  // Summary
  // ============================================
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('                      Test Summary');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  ${colors.green}Passed: ${passed}${colors.reset}`);
  console.log(`  ${colors.red}Failed: ${failed}${colors.reset}`);
  console.log(`  Total:  ${passed + failed}`);
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  console.error('Test runner failed:', error);
  process.exit(1);
});

