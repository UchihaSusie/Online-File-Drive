const axios = require("axios");
const { v4: uuidv4 } = require("uuid");

// AWS SDK for S3 presigned URL
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

// DynamoDB
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand
} = require("@aws-sdk/lib-dynamodb");

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient());
const s3 = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });

exports.handler = async (event) => {
  console.log("Incoming event:", JSON.stringify(event));

  const tableName = process.env.TABLE_NAME;
  const metadataSvc = process.env.FILE_SERVICE_URL;
  const bucket = process.env.BUCKET_NAME;

  const method = event.httpMethod;
  const rawPath = event.resource;
  const headers = event.headers || {};

  // ---------------------------------------------------------------------------
  // 1. POST /share → owner creates a share link
  // ---------------------------------------------------------------------------
  if (method === "POST" && rawPath === "/share") {
    try {
      const body = JSON.parse(event.body || "{}");
      const fileId = body.fileId;
      if (!fileId) return res(400, { message: "fileId is required" });

      const userId = headers["x-user-id"] || headers["X-User-Id"];
      if (!userId) return res(401, { message: "Missing x-user-id header" });

      // 1) call metadata-service
      const metaRes = await axios.get(`${metadataSvc}/api/metadata/${fileId}`, {
        headers: {
          Authorization: headers.authorization || headers.Authorization || "",
          "x-user-id": headers["x-user-id"] || headers["X-User-Id"] || ""
        }
      });
      const metadata = metaRes.data.metadata;

      if (metadata.userId !== userId)
        return res(403, { message: "You do not own this file" });

      // 2) save share (only fileId → share-service handles public)
      const publicId = uuidv4();
      await ddb.send(
        new PutCommand({
          TableName: tableName,
          Item: {
            publicId,
            fileId,
            ownerId: userId,
            createdAt: Date.now()
          }
        })
      );

      const host = headers["Host"];
      const stage = event.requestContext.stage;
      const shareUrl = `https://${host}/${stage}/share/${publicId}`;

      return res(200, { message: "Share link created", publicId, url: shareUrl });

    } catch (err) {
      console.error("POST /share ERROR:", err);
      return res(500, { message: "Internal error", error: err.toString() });
    }
  }

  // ---------------------------------------------------------------------------
  // 2. GET /share/{publicId} → generate S3 presigned URL
  // ---------------------------------------------------------------------------
  if (method === "GET" && rawPath === "/share/{publicId}") {
    try {
      const publicId = event.pathParameters.publicId;

      // 1) lookup share record
      const getRes = await ddb.send(
        new GetCommand({
          TableName: tableName,
          Key: { publicId }
        })
      );
      if (!getRes.Item) return res(404, { message: "Share link not found" });

      const fileId = getRes.Item.fileId;

      // 2) read metadata to build S3 key
      const metaRes = await axios.get(`${metadataSvc}/api/metadata/${fileId}`, {
        headers: {
          // share link is public, so pass empty auth
          Authorization: "",
          "x-user-id": ""   // public access, no user id needed
        }
      });
      const metadata = metaRes.data.metadata;

      const userId = metadata.userId;
      const version = metadata.currentVersion;
      const filename = metadata.filename;

      const key = `${userId}/${fileId}/v${version}/${filename}`;

      // 3) generate presigned URL
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key
      });

      const signedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });

      // 4) redirect user
      return {
        statusCode: 302,
        headers: { Location: signedUrl },
        body: ""
      };

    } catch (err) {
      console.error("GET /share/{publicId} ERROR:", err);
      return res(500, { message: "Internal error", error: err.toString() });
    }
  }

  return res(400, { message: "Invalid request" });
};


// Response helper
function res(code, body) {
  return {
    statusCode: code,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  };
}