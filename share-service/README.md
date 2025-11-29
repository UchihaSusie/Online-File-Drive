README - Share Service (Public File Sharing Microservice)

This microservice enables public sharing of files in a cloud-drive system, similar to Google Drive's "Anyone with the link" feature.

It provides:
1. POST /share  – owner creates a public share link.
2. GET /share/{publicId} – anyone can download the file without authentication.

The service does not use token authentication for downloads.  
It does not depend on the file-management service.  
It only calls metadata-service and generates S3 presigned URLs directly.

------------------------------------------------------------
Environment Variables
------------------------------------------------------------

FILE_SERVICE_URL = https://votmaqe624.execute-api.us-east-1.amazonaws.com/prod
BUCKET_NAME = 6620-cloud-drive-files

(UPLOAD_SERVICE_URL is NOT required.)

------------------------------------------------------------
API Endpoints
------------------------------------------------------------

1. POST /share
   Purpose: Create a public share link.
   Headers:
     x-user-id: <owner userId>
     Authorization: Bearer <token>   (only needed because metadata-service requires it)

   Body:
     {
       "fileId": "<file-id>"
     }

   Response:
     {
       "message": "Share link created",
       "publicId": "<uuid>",
       "url": "https://<api-domain>/<stage>/share/<publicId>"
     }

------------------------------------------------------------

2. GET /share/{publicId}
   Purpose: Public download (no login required)
   Process:
     • Look up publicId in DynamoDB
     • Get file metadata from metadata-service
     • Build S3 key: {userId}/{fileId}/v{version}/{filename}
     • Generate presigned S3 URL
     • Redirect (302) to presigned URL

   Result:
     Browser begins download automatically

------------------------------------------------------------
DynamoDB Table (ShareTable)
------------------------------------------------------------

Partition key: publicId (string)

Example item:
{
  "publicId": "uuid",
  "fileId": "abc123",
  "ownerId": "user567",
  "createdAt": 1732767000000
}

------------------------------------------------------------
S3 Key Format
------------------------------------------------------------

Computed using metadata-service:
    userId / fileId / v{version} / filename

Example:
    user123 / abc123 / v3 / report.pdf

------------------------------------------------------------
CDK Resources Created
------------------------------------------------------------

• DynamoDB table: ShareTable
• Lambda function: ShareHandler
• API Gateway:
    POST /share
    GET /share/{publicId}

Lambda IAM policy required:
    s3:GetObject on arn:aws:s3:::6620-cloud-drive-files/*

------------------------------------------------------------
Project Structure
------------------------------------------------------------

share-service/
  lib/
    share-service-stack.js
  lambda/
    index.js
  package.json
  README.txt

------------------------------------------------------------
Flow Summary
------------------------------------------------------------

POST /share:
  - Validate user
  - Fetch metadata
  - Store publicId in DynamoDB
  - Return public URL

GET /share/{publicId}:
  - Lookup publicId
  - Retrieve metadata
  - Generate S3 presigned URL
  - Redirect to file

------------------------------------------------------------
End of README
------------------------------------------------------------