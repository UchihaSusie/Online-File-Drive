# File Management Service

Microservice for handling file uploads, downloads, versioning, and deletion for the Cloud Drive application.

## Features

- ✅ File upload with S3 storage
- ✅ File download with presigned URLs
- ✅ File versioning (maintains 3 versions)
- ✅ File deletion (all versions)
- ✅ Storage quota validation
- ✅ JWT authentication
- ✅ Multi-part file upload support

## APIs Endpoints

### Upload File

Upload a new file (creates version 1).
httpPOST /api/files/upload
Authorization: Bearer {token}
Content-Type: multipart/form-data
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| file | File | Yes | File to upload (max 100MB) |
| folderId | String | No | Parent folder ID (null for root) |
| isPublic | Boolean | No | Public visibility (default: false) |

#### Request Example

**cURL:**
```bash
curl -X POST http://localhost:3002/api/files/upload \
  -H "Authorization: Bearer eyJhbGc..." \
  -F "file=@document.pdf" \
  -F "folderId=folder123" \
  -F "isPublic=false"
```

**JavaScript (Fetch API):**
```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('folderId', 'folder123');
formData.append('isPublic', 'false');

const response = await fetch('http://localhost:3002/api/files/upload', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});

const data = await response.json();
```

#### Success Response

**Status:** `201 Created`
```json
{
  "message": "File uploaded successfully",
  "file": {
    "fileId": "1732612345678-xyz789",
    "filename": "document.pdf",
    "size": 524288,
    "mimeType": "application/pdf",
    "currentVersion": 1
  }
}
```

#### Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 400 | NO_FILE | No file provided in request |
| 400 | VALIDATION_ERROR | Invalid request parameters |
| 401 | AUTH_INVALID_TOKEN | Invalid or expired token |
| 413 | INSUFFICIENT_STORAGE | User storage quota exceeded |
| 413 | FILE_TOO_LARGE | File exceeds 100MB size limit |
| 500 | UPLOAD_FAILED | File upload failed |

---

### Update File

Upload a new version of an existing file.
```http
PUT /api/files/:fileId
Authorization: Bearer {token}
Content-Type: multipart/form-data
```
### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| fileId | String | Yes | ID of file to update |

### Form Data Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| file | File | Yes | Updated file (max 100MB) |

#### Request Example

**cURL:**
```bash
curl -X PUT http://localhost:3002/api/files/1732612345678-xyz789 \
  -H "Authorization: Bearer eyJhbGc..." \
  -F "file=@document-v2.pdf"
```

**JavaScript:**
```javascript
const formData = new FormData();
formData.append('file', updatedFile);

const response = await fetch(`http://localhost:3002/api/files/${fileId}`, {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});
```

#### Success Response

**Status:** `200 OK`
```json
{
  "message": "File updated successfully",
  "file": {
    "fileId": "1732612345678-xyz789",
    "filename": "document-v2.pdf",
    "size": 548864,
    "mimeType": "application/pdf",
    "currentVersion": 2,
    "totalVersions": 2
  }
}
```

#### Version Management Rules

- **Maximum Versions:** 3 versions are maintained
- **Version Rotation:** When creating version 4, version 1 is automatically deleted
- **S3 Storage:** Each version stored at `{userId}/{fileId}/v{N}/{filename}`
- **Metadata:** All versions tracked in metadata service

#### Workflow

1. Validates file presence and ownership
2. Checks storage quota (only for size increase)
3. Calculates next version number
4. Uploads new version to S3
5. Deletes oldest version if more than 3 versions exist
6. Updates metadata with new version info
7. Returns updated file information with rotation message if applicable

### Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 400 | NO_FILE | No file provided in request |
| 401 | AUTH_INVALID_TOKEN | Invalid or expired token |
| 403 | ACCESS_DENIED | User is not the file owner |
| 404 | FILE_NOT_FOUND | File does not exist |
| 413 | INSUFFICIENT_STORAGE | Not enough storage quota |
| 500 | UPDATE_FAILED | File update failed |

---

### Download File

Generate a presigned URL for downloading a file.
```http
GET /api/files/:fileId/download
Authorization: Bearer {token}
```

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| fileId | String | Yes | ID of file to download |

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| version | Integer | No | Specific version number, defaults to current |

#### Request Examples

**Download Current Version:**
```bash
curl http://localhost:3002/api/files/1732612345678-xyz789/download \
  -H "Authorization: Bearer eyJhbGc..."
```

**Download Specific Version:**
```bash
curl "http://localhost:3002/api/files/1732612345678-xyz789/download?version=1" \
  -H "Authorization: Bearer eyJhbGc..."
```

**JavaScript:**
```javascript
// Download current version
const response = await fetch(
  `http://localhost:3002/api/files/${fileId}/download`,
  {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
);

const { downloadUrl } = await response.json();
window.location.href = downloadUrl; // Trigger download

// Download specific version
const response = await fetch(
  `http://localhost:3002/api/files/${fileId}/download?version=2`,
  {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
);
```

### Success Response

**Status:** `200 OK`
```json
{
  "message": "Download URL generated",
  "downloadUrl": "https://s3.amazonaws.com/cloud-drive-files/user123/file456/v2/document.pdf?X-Amz-Algorithm=AWS4-HMAC-SHA256&...",
  "filename": "document.pdf",
  "version": 2,
  "size": 548864,
  "expiresIn": 3600
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| downloadUrl | String | Presigned S3 URL (valid for 1 hour) |
| filename | String | Original filename |
| version | Number | Version number being downloaded |
| size | Number | File size in bytes |
| expiresIn | Number | URL expiration time in seconds (3600) |

### Access Control

- **Owner:** Can download any version
- **Public Files:** Anyone with the file ID can download
- **Private Files:** Only the owner can download

### Workflow

1. Retrieves file metadata
2. Checks user permissions (owner or public file)
3. Finds requested version (or uses current)
4. Generates presigned S3 URL (valid for 1 hour)
5. Returns download URL

### Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 400 | INVALID_VERSION | Invalid version number provided |
| 401 | AUTH_INVALID_TOKEN | Invalid or expired token |
| 403 | ACCESS_DENIED | User lacks permission to access file |
| 404 | FILE_NOT_FOUND | File does not exist |
| 404 | VERSION_NOT_FOUND | Specified version does not exist |
| 500 | DOWNLOAD_FAILED | Failed to generate download URL |

---

### Get File Versions

List all versions of a file.
```http
GET /api/files/:fileId/versions
Authorization: Bearer {token}
```

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| fileId | String | Yes | ID of file |

#### Request Example
```bash
curl http://localhost:3002/api/files/1732612345678-xyz789/versions \
  -H "Authorization: Bearer eyJhbGc..."
```

**JavaScript:**
```javascript
const response = await fetch(
  `http://localhost:3002/api/files/${fileId}/versions`,
  {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
);

const data = await response.json();
```

#### Success Response

**Status:** `200 OK`
```json
{
  "message": "Versions retrieved successfully",
  "fileId": "1732612345678-xyz789",
  "filename": "document.pdf",
  "currentVersion": 3,
  "versions": [
    {
      "version": 1,
      "size": 524288,
      "createdAt": "2025-11-01T10:00:00.000Z",
      "isCurrent": false
    },
    {
      "version": 2,
      "size": 548864,
      "createdAt": "2025-11-15T14:30:00.000Z",
      "isCurrent": false
    },
    {
      "version": 3,
      "size": 563200,
      "createdAt": "2025-11-26T09:15:00.000Z",
      "isCurrent": true
    }
  ]
}
```

#### Version Object Fields

| Field | Type | Description |
|-------|------|-------------|
| version | Number | Version number |
| size | Number | File size in bytes for this version |
| createdAt | String | ISO 8601 timestamp of version creation |
| isCurrent | Boolean | Whether this is the current version |

#### Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 401 | AUTH_INVALID_TOKEN | Invalid or expired token |
| 403 | ACCESS_DENIED | User lacks permission to access file |
| 404 | FILE_NOT_FOUND | File does not exist |
| 500 | INTERNAL_ERROR | Server error |

---
### Delete File

Permanently delete a file and all its versions.
```http
DELETE /api/files/:fileId
Authorization: Bearer {token}
```

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| fileId | String | Yes | ID of file to delete |

#### Request Example

**cURL:**
```bash
curl -X DELETE http://localhost:3002/api/files/1732612345678-xyz789 \
  -H "Authorization: Bearer eyJhbGc..."
```

**JavaScript:**
```javascript
const response = await fetch(
  `http://localhost:3002/api/files/${fileId}`,
  {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
);
```

#### Success Response

**Status:** `200 OK`
```json
{
  "message": "File and all versions deleted successfully",
  "deletedVersions": 3
}
```

#### What Gets Deleted

- ✅ All version files from S3 storage
- ✅ All metadata records
- ✅ File references in folders
- ⚠️ Associated share links (should be handled by Sharing service)

#### Workflow

1. Validates ownership
2. Retrieves all version information
3. Deletes each version from S3
4. Deletes metadata record
5. Returns count of deleted versions

#### Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 401 | AUTH_INVALID_TOKEN | Invalid or expired token |
| 403 | ACCESS_DENIED | User is not the file owner |
| 404 | FILE_NOT_FOUND | File does not exist |
| 500 | DELETE_FAILED | Deletion failed |

---
### List User Files

List all files owned by the authenticated user.
```http
GET /api/files
Authorization: Bearer {token}
```

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| folderId | String | No | Filter by folder ID (use "root" for root directory, or specific folder ID) |

#### Request Examples

**List All Files:**
```bash
curl http://localhost:3002/api/files \
  -H "Authorization: Bearer eyJhbGc..."
```

**List Files in Folder:**
```bash
curl "http://localhost:3002/api/files?folderId=folder123" \
  -H "Authorization: Bearer eyJhbGc..."
```

**JavaScript:**
```javascript
// All files
const response = await fetch('http://localhost:3002/api/files', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

// Files in specific folder
const response = await fetch(
  'http://localhost:3002/api/files?folderId=folder123',
  {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
);
```

#### Success Response

**Status:** `200 OK`
```json
{
  "message": "Files retrieved successfully",
  "files": [
    {
      "fileId": "1732612345678-xyz789",
      "userId": "1732612345678-abc123",
      "filename": "document.pdf",
      "mimeType": "application/pdf",
      "size": 563200,
      "folderId": "folder123",
      "isPublic": false,
      "currentVersion": 3,
      "createdAt": "2025-11-01T10:00:00.000Z",
      "updatedAt": "2025-11-26T09:15:00.000Z"
    },
    {
      "fileId": "1732612345678-abc456",
      "userId": "1732612345678-abc123",
      "filename": "image.jpg",
      "mimeType": "image/jpeg",
      "size": 1048576,
      "folderId": "folder123",
      "isPublic": true,
      "currentVersion": 1,
      "createdAt": "2025-11-20T14:00:00.000Z",
      "updatedAt": "2025-11-20T14:00:00.000Z"
    }
  ],
  "count": 2
}
```

#### Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 401 | AUTH_INVALID_TOKEN | Invalid or expired token |
| 500 | INTERNAL_ERROR | Server error |

---

### Health Check

Check service health status.
```http
GET /health
```

**No authentication required.**

#### Request Example
```bash
curl http://localhost:3002/health
```

#### Success Response

**Status:** `200 OK`
```json
{
  "status": "healthy",
  "service": "file-management",
  "version": "1.0.0",
  "timestamp": "2025-11-26T10:30:00.000Z",
  "uptime": 3600
}
```

## Service Integration Requirements

### Metadata Service Integration

The file-management service **requires** a metadata service to store file information. 

**Metadata Service Endpoints Required:**
- `POST /api/metadata` - Create file metadata
- `GET /api/metadata/:fileId` - Get file metadata
- `PUT /api/metadata/:fileId` - Update file metadata
- `DELETE /api/metadata/:fileId` - Delete file metadata
- `GET /api/metadata?userId=xxx` - List user files

check mock-metadata-service.js

**Expected Response Format:**
```json
{
  "message": "Success message",
  "metadata": {
    "fileId": "...",
    "userId": "...",
    "filename": "...",
    "size": 123,
    "currentVersion": 1,
    "versions": [...]
  }
}
```

## Data Models

### File Metadata Object
```typescript
{
  fileId: string;          // Unique file identifier
  userId: string;          // Owner's user ID
  filename: string;        // Original filename
  mimeType: string;        // MIME type (e.g., "application/pdf")
  size: number;            // Current version size in bytes
  s3Key: string;           // Current version S3 object key
  s3Bucket: string;        // S3 bucket name
  folderId: string | null; // Parent folder ID (null = root)
  isPublic: boolean;       // Public visibility flag
  currentVersion: number;  // Current version number (1-3)
  versions: Version[];     // Array of version objects
  createdAt: string;       // ISO 8601 timestamp
  updatedAt: string;       // ISO 8601 timestamp
}
```

### Version Object
```typescript
{
  version: number;         // Version number
  s3Key: string;           // S3 object key for this version
  size: number;            // File size in bytes for this version
  createdAt: string;       // ISO 8601 timestamp of creation
}
```

### S3 Key Pattern

Files are stored in S3 with the following key pattern:
```
{userId}/{fileId}/v{versionNumber}/{filename}
```

**Examples:**
```
1732612345678-abc123/1732612345678-xyz789/v1/document.pdf
1732612345678-abc123/1732612345678-xyz789/v2/document.pdf
1732612345678-abc123/1732612345678-xyz789/v3/document.pdf
```

---


### 

## Prerequisites

- Node.js 16+
- AWS Account with S3 bucket (for AWS deployment)
- Docker (for AWS deployment)
- AWS CLI configured (for AWS deployment)

## Installation

```bash
npm install
```

## Local Development

### Option 1: Run File Management Service Only

**Requirements:** Auth service and Metadata service must be running separately.

```bash
# Development mode (auto-restart on file changes)
npm run dev

# Production mode (manual restart required)
npm start
```

### Option 2: Run All Services Together (Recommended for Testing)

Use the provided script to start all three services at once:

```bash
cd scripts/test
./start-services.sh
```

This automatically starts:
- **Auth Service** (port 3000) - User authentication
- **Mock Metadata Service** (port 3001) - File metadata storage (in-memory)
- **File Management Service** (port 3002) - File upload/download

**Stop all services:**
```bash
cd scripts/test
./stop-services.sh
```

**View logs:**
```bash
tail -f /tmp/auth-service.log
tail -f /tmp/metadata-service.log
tail -f /tmp/file-mgmt-service.log
```

### Testing with Postman

1. [postman collection](https://group-6-0129.postman.co/workspace/My-Workspace~47b3eb91-1dae-43c7-8557-20826c9cb3af/request/35012301-539d84c0-85d5-4026-913a-6895dabd2c05?action=share&creator=35012301)
2. Run "Register User" to get auth token (auto-saved)
3. Run "Upload File" with form-data (select a file)
4. Run "List Files", "Download File", etc.

**Important:** 
- Auth endpoints use `raw` + `JSON` body
- File upload uses `form-data` body

## AWS Deployment

### Deploy to AWS (Complete Infrastructure)

Deploy everything (ECR, ECS, S3, VPC, Load Balancer) using CDK:

```bash
cd cdk
npm install
npm run build
cdk deploy
```

**What happens:**
1. ✅ CDK automatically builds Docker image locally (`linux/amd64`)
2. ✅ Creates CDK-managed ECR repository
3. ✅ Pushes Docker image to ECR
4. ✅ Deploys infrastructure (takes ~10-15 minutes)
5. ✅ Starts ECS service with the pushed image
6. ✅ Shows service URL in outputs

**What gets deployed:**
- **S3 Bucket**: `6620-cloud-drive-files` (encrypted storage, auto-delete on destroy)
- **ECR Repository**: CDK-managed container registry (auto-delete images on destroy)
- **ECS Fargate**: Auto-scaling (1-10 tasks), CPU & memory based
- **Application Load Balancer**: Public endpoint on port 80
- **VPC**: 2 AZs with public/private subnets, 1 NAT Gateway
- **CloudWatch Logs**: `/ecs/file-management-service` (7-day retention)

### After Deployment

**Service URL is shown in CDK output:**
```
Outputs:
FileManagementStack.ServiceUrl = http://file-management-alb-xxxxx.us-west-2.elb.amazonaws.com
```

**Or retrieve it anytime with:**
```bash
aws cloudformation describe-stacks \
  --stack-name FileManagementStack \
  --region us-west-2 \
  --query 'Stacks[0].Outputs[?OutputKey==`ServiceUrl`].OutputValue' \
  --output text
```

**Test health endpoint:**
```bash
# Using the URL from CDK output
curl http://YOUR-ALB-DNS/health

# Or in one command
curl $(aws cloudformation describe-stacks \
  --stack-name FileManagementStack \
  --region us-west-2 \
  --query 'Stacks[0].Outputs[?OutputKey==`ServiceUrl`].OutputValue' \
  --output text)/health
```

**View logs:**
```bash
aws logs tail /ecs/file-management-service --follow --region us-west-2
```

**Check service status:**
```bash
aws ecs describe-services \
  --cluster file-management-cluster \
  --services file-management-service \
  --region us-west-2
```

### Update Deployed Service

After code changes, redeploy (CDK automatically rebuilds and pushes new image):
```bash
cd cdk
cdk deploy
```

CDK will:
- Rebuild Docker image with your changes
- Push new image to ECR
- Update ECS task definition
- Perform rolling deployment (zero downtime)

### Destroy AWS Resources

Remove all deployed infrastructure:

```bash
cd cdk
cdk destroy
```

**What gets deleted:**
- ✅ ECR repository (all images automatically deleted via `emptyOnDelete: true`)
- ✅ S3 bucket (all files automatically deleted via `autoDeleteObjects: true`)
- ✅ ECS cluster, service, and tasks
- ✅ Application Load Balancer
- ✅ VPC, subnets, NAT gateway
- ✅ CloudWatch log groups
- ✅ IAM roles and policies

**Note:** Both the ECR repository and S3 bucket are configured with `DESTROY` removal policy, so all images and files will be automatically cleaned up when the stack is destroyed.

### Configuration

**Optional environment variables** (set before `cdk deploy`):
```bash
export AUTH_SERVICE_URL=http://your-auth-service
export METADATA_SERVICE_URL=http://your-metadata-service
export JWT_SECRET=your-secret-key
```

These can also be passed via CDK context:
```bash
cdk deploy \
  --context authServiceUrl=http://your-auth \
  --context metadataServiceUrl=http://your-metadata \
  --context jwtSecret=your-secret
```

### Troubleshooting

**Service won't start:**
```bash
aws logs tail /ecs/file-management-service --follow --region us-west-2
```

**Docker build issues:**
```bash
# CDK builds Docker locally, check Docker is running
docker ps

# View CDK synth to see generated CloudFormation
cdk synth
```

**Health check failing:**
- Verify container port is 3002
- Check security groups allow ALB → ECS communication
- Verify environment variables in task definition
- Check ECS service events: `aws ecs describe-services ...`

For detailed CDK documentation, see [cdk/README.md](./cdk/README.md)

