# Metadata + Search Service

> This service provides file metadata storage and search functionality for the Cloud Drive application.

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AWS Cloud (us-east-1)                          │
│                                                                             │
│  ┌───────────────┐     ┌─────────────────┐     ┌──────────────────────────┐ │
│  │  API Gateway  │────▶│  Lambda Function│────▶│  DynamoDB                │ │
│  │  REST API     │     │  (Node.js 18)   │     │  Table: cloud-drive-files│ │
│  │               │     │  Express App    │     │  GSI: userId-createdAt   │ │
│  └───────────────┘     └─────────────────┘     └──────────────────────────┘ │
│         ▲                                                                   │
└─────────│───────────────────────────────────────────────────────────────────┘
          │
    ┌─────┴─────┐
    │  Clients  │
    │ - Browser │
    │ - File    │
    │   Mgmt    │
    │   Service │
    └───────────┘
```

## 🔗 Service Integration

| Service | Port | Owner | Integration |
|---------|------|-------|-------------|
| Auth Service | 3000 | Henny | Provides JWT tokens |
| Metadata Service | 3001 | Minghui | Stores file metadata, provides search |
| File Management | 3002 | Roybn | Calls Metadata Service for CRUD |

**Data Flow:**
1. User uploads file via File Management Service
2. File Management calls `POST /api/metadata` to store metadata
3. User can search files via `/api/files/search/*` endpoints

---

## 📡 API Endpoints

### Health Check (No Auth Required)

```http
GET /health
```

### Metadata APIs (Used by File Management Service)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/metadata` | Create file metadata |
| `GET` | `/api/metadata/:fileId` | Get single file metadata |
| `PUT` | `/api/metadata/:fileId` | Update file metadata |
| `DELETE` | `/api/metadata/:fileId` | Delete file metadata |
| `GET` | `/api/metadata?userId=` | List user's files |

### Search APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/files/search?q={keyword}` | Search by filename keyword |
| `GET` | `/api/files/search/by-type?type={type}` | Search by file type |
| `GET` | `/api/files/search/recent?days=7` | Get recent uploads |
| `GET` | `/api/files/search/stats` | Get file statistics |
| `GET` | `/api/files/search/list` | **List files with sorting** |
| `GET` | `/api/files/search/sort-options` | Get available sort options |

**Supported file types for search:**
- `image` - JPEG, PNG, GIF, etc.
- `video` - MP4, AVI, MOV, etc.
- `audio` - MP3, WAV, etc.
- `pdf` - PDF documents
- `document` - Word, Excel, PowerPoint
- `text` - TXT, CSV, etc.

### Sorting Parameters

The `/api/files/search` and `/api/files/search/list` endpoints support sorting:

| Parameter | Values | Default | Description |
|-----------|--------|---------|-------------|
| `sortBy` | `name`, `updatedAt`, `createdAt`, `size`, `type` | `updatedAt` | Field to sort by |
| `sortDirection` | `asc`, `desc` | `desc` | Sort direction |

**Examples:**
```bash
# List files sorted by name A-Z
GET /api/files/search/list?sortBy=name&sortDirection=asc

# List files sorted by name Z-A
GET /api/files/search/list?sortBy=name&sortDirection=desc

# List files by last modified (newest first)
GET /api/files/search/list?sortBy=updatedAt&sortDirection=desc

# List files by last modified (oldest first)
GET /api/files/search/list?sortBy=updatedAt&sortDirection=asc

# Search with sorting
GET /api/files/search?q=report&sortBy=name&sortDirection=asc

# Get available sort options (for frontend dropdowns)
GET /api/files/search/sort-options
```

### Frontend Integration Example

```javascript
// Default view - show files sorted by last modified
const response = await fetch('/api/files/search/list?sortBy=updatedAt&sortDirection=desc', {
    headers: { 'Authorization': `Bearer ${token}` }
});

// User clicks "Name (A-Z)" sort option
const response = await fetch('/api/files/search/list?sortBy=name&sortDirection=asc', {
    headers: { 'Authorization': `Bearer ${token}` }
});

// User searches with sorting
const response = await fetch('/api/files/search?q=report&sortBy=name&sortDirection=asc', {
    headers: { 'Authorization': `Bearer ${token}` }
});

// Get sort options for dropdown menu
const options = await fetch('/api/files/search/sort-options', {
    headers: { 'Authorization': `Bearer ${token}` }
});
// Returns: { sortBy: [{value: 'name', label: 'Name'}, ...], sortDirection: [...] }
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18
- AWS CLI configured (`aws configure`)
- AWS CDK (`npm install -g aws-cdk`)

### 1. Deploy to AWS (Recommended)

```bash
cd metadata-service

# Make deploy script executable
chmod +x scripts/deploy.sh

# Deploy to AWS
./scripts/deploy.sh
```

**What gets deployed:**
- DynamoDB Table: `cloud-drive-files`
- Lambda Function: `metadata-service`
- API Gateway: REST API with all endpoints

**After deployment, you'll see:**
```
🎉 Deployment Successful!

📍 API URL: https://xxxxxxxx.execute-api.us-east-1.amazonaws.com/prod
```


After deployment, replace the API URL in file-management .env

```bash
# Add to file-management .env
METADATA_SERVICE_URL=https://xxxxxxxx.execute-api.us-east-1.amazonaws.com/prod
```

### 2. Verify Deployment

```bash
# Health check
curl https://xxxxxxxx.execute-api.us-east-1.amazonaws.com/prod/health
```

---

## 🧪 Testing

### Test with cURL

First, get a JWT token from Auth Service:

```bash
# Login to get token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"replacewithyour@email.com","password":"replacewithyourpassword"}'
```

Then test the APIs:

```bash
# Set variables
API_URL="https://xxxxxxxx.execute-api.us-east-1.amazonaws.com/prod"
TOKEN="your-jwt-token"

# Health check (no auth needed)
curl "$API_URL/health"

# Create metadata
curl -X POST "$API_URL/api/metadata" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "fileId": "file-001",
    "userId": "your-user-id",
    "filename": "report.pdf",
    "mimeType": "application/pdf",
    "size": 1024000
  }'

# Search by keyword
curl "$API_URL/api/files/search?q=report" \
  -H "Authorization: Bearer $TOKEN"

# Search by type
curl "$API_URL/api/files/search/by-type?type=pdf" \
  -H "Authorization: Bearer $TOKEN"

# Get recent files
curl "$API_URL/api/files/search/recent?days=7" \
  -H "Authorization: Bearer $TOKEN"

# Get statistics
curl "$API_URL/api/files/search/stats" \
  -H "Authorization: Bearer $TOKEN"

# List files sorted by name (A-Z)
curl "$API_URL/api/files/search/list?sortBy=name&sortDirection=asc" \
  -H "Authorization: Bearer $TOKEN"

# List files sorted by last modified (newest first)
curl "$API_URL/api/files/search/list?sortBy=updatedAt&sortDirection=desc" \
  -H "Authorization: Bearer $TOKEN"

# Get available sort options
curl "$API_URL/api/files/search/sort-options" \
  -H "Authorization: Bearer $TOKEN"
```

### Add Test Data

```bash
# Edit the USER_ID in the script first
nano scripts/seed-test-data.js

# Run seed script
node scripts/seed-test-data.js
```

### Run Automated Tests

```bash
export API_URL="https://xxxxxxxx.execute-api.us-east-1.amazonaws.com/prod"
export AUTH_TOKEN="your-jwt-token"
export USER_ID="your-user-id"

node scripts/test-api.js
```

---

## 💻 Local Development

### Option 1: Use AWS DynamoDB (Recommended)

This uses the DynamoDB table in AWS but runs the server locally:

```bash
cd metadata-service

# Install dependencies
npm install

# Start local server (uses AWS DynamoDB)
./scripts/local-start.sh
# or
npm run local
```

Server runs at `http://localhost:3001`

---

## 📁 Project Structure

```
metadata-service/
├── package.json              
├── .gitignore                
├── README.md                 
├── src/
│   ├── app.js                
│   ├── lambda.js             
│   ├── routes/
│   │   ├── metadataRoutes.js # CRUD endpoints
│   │   └── searchRoutes.js   # Search endpoints
│   └── services/
│       └── searchService.js  # Search & Sort logic
├── scripts/
│   ├── deploy.sh             # AWS deployment script
│   ├── local-start.sh        # Local dev server
│   ├── seed-test-data.js     # Generate test data
│   └── test-api.js           # API test script
└── cdk/
    ├── bin/cdk.ts            
    ├── lib/metadata-stack.ts 
    ├── package.json          
    ├── tsconfig.json         
    └── cdk.json              
```

---

## 🔧 Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server port (local only) |
| `AWS_REGION` | `us-east-1` | AWS region |
| `TABLE_NAME` | `cloud-drive-files` | DynamoDB table name |
| `NODE_ENV` | `production` | Environment mode |

---

## 📊 AWS Console Verification

After deployment, verify resources in AWS Console:

| Resource | Location |
|----------|----------|
| DynamoDB | [DynamoDB Console](https://console.aws.amazon.com/dynamodb) → Tables → `cloud-drive-files` |
| Lambda | [Lambda Console](https://console.aws.amazon.com/lambda) → Functions → `metadata-service` |
| API Gateway | [API Gateway Console](https://console.aws.amazon.com/apigateway) → APIs → `Metadata Search Service API` |
| Logs | [CloudWatch Console](https://console.aws.amazon.com/cloudwatch) → Log groups → `/aws/lambda/metadata-service` |

---

## 🔄 Integrate with File Management Service

1. **Get the API URL** from deployment output

2. **Set environment variable:**
```bash
# In file-management/.env
METADATA_SERVICE_URL=https://xxxxxxxx.execute-api.us-east-1.amazonaws.com/prod
```

3. **Expected API responses:**

```json
// POST /api/metadata response
{
  "message": "Metadata created successfully",
  "metadata": {
    "fileId": "...",
    "userId": "...",
    "filename": "...",
    "size": 123,
    "currentVersion": 1,
    "versions": []
  }
}

// GET /api/metadata/:fileId response
{
  "message": "Metadata retrieved successfully",
  "metadata": { ... }
}

// GET /api/metadata?userId=xxx response
{
  "message": "Files retrieved successfully",
  "files": [ ... ],
  "count": 10
}

// GET /api/files/search/list response (with sorting)
{
  "files": [ ... ],
  "count": 10,
  "sortBy": "name",
  "sortDirection": "asc"
}

// GET /api/files/search/sort-options response
{
  "options": {
    "sortBy": [
      { "value": "name", "label": "Name" },
      { "value": "updatedAt", "label": "Last Modified" },
      { "value": "createdAt", "label": "Date Created" },
      { "value": "size", "label": "Size" },
      { "value": "type", "label": "Type" }
    ],
    "sortDirection": [
      { "value": "asc", "label": "Ascending" },
      { "value": "desc", "label": "Descending" }
    ]
  }
}
```

---

## 🗑️ Cleanup

### Remove AWS Resources

```bash
./scripts/deploy.sh destroy
```

⚠️ **Warning:** This deletes the DynamoDB table and ALL data!

---

## ❓ Troubleshooting

### "Table not found" error
- Ensure CDK deployment completed successfully
- Check if table exists in DynamoDB Console
- Verify AWS_REGION is correct (us-east-1)

### "Unauthorized" error
- Ensure Authorization header is present: `Authorization: Bearer <token>`
- Verify token is valid (get fresh token from Auth Service)

### Lambda timeout
- Check CloudWatch logs for errors
- Increase Lambda timeout in `metadata-stack.ts` if needed

### Search returns no results
- Verify files exist in DynamoDB table
- Check if userId matches the token's userId
- Run `seed-test-data.js` to add test data

