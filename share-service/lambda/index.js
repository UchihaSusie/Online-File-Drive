const axios = require("axios");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");

const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand
} = require("@aws-sdk/lib-dynamodb");

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient());
const s3 = new S3Client({
  region: process.env.BUCKET_REGION,
  forcePathStyle: false,
});

const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "Content-Type,Authorization,X-User-Id,X-Amz-Date,X-Api-Key,X-Amz-Security-Token",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
};

// ---------------------------------------
// Handler
// ---------------------------------------
exports.handler = async (event) => {
  console.log("Event:", JSON.stringify(event));

  const tableName = process.env.TABLE_NAME;
  const metadataSvc = process.env.FILE_SERVICE_URL;
  const bucket = process.env.BUCKET_NAME;

  const method = event.httpMethod;
  const rawPath = event.resource;
  const headers = event.headers || {};

  // Options Preflight
  if (method === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ""
    };
  }

  // ------------------------------------
  // POST /share -> Create share link
  // ------------------------------------
  if (method === "POST" && rawPath === "/share") {
    try {
      const body = JSON.parse(event.body || "{}");
      const fileId = body.fileId;
      if (!fileId) return res(400, { message: "fileId is required" });

      const userId = headers["x-user-id"] || headers["X-User-Id"];
      if (!userId) return res(401, { message: "Missing x-user-id header" });

      // Call metadata service (owner validation)
      const metaRes = await axios.get(
        `${metadataSvc}/api/metadata/${fileId}`,
        {
          headers: {
            Authorization: headers.Authorization || headers.authorization || "",
            "x-user-id": userId
          }
        }
      );

      const metadata = metaRes.data.metadata;

      if (metadata.userId !== userId) {
        return res(403, { message: "You do not own this file" });
      }

      // Insert share record
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

      // ------------------------
      // Generate JWT token
      // ------------------------
      const token = jwt.sign(
        {
          fileId,
          filename: metadata.filename,
          version: metadata.currentVersion,
          userId: metadata.userId
        },
        JWT_SECRET,
        { expiresIn: "1d" }
      );

      const host = headers["Host"];
      const stage = event.requestContext.stage;
      const url = `https://${host}/${stage}/share/${publicId}?token=${token}`;

      return res(200, {
        message: "Share link created",
        publicId,
        url
      });
    } catch (err) {
      console.error("POST /share ERROR:", err);
      return res(500, { message: "Internal error", error: err.toString() });
    }
  }

  // ------------------------------------
  // GET /share/{publicId}?token=xxxx
  // ------------------------------------
  if (method === "GET" && event.path && event.path.startsWith("/share/")) {
    try {
      const publicId = event.pathParameters.publicId;

      // Verify share exists
      const shareRes = await ddb.send(
        new GetCommand({
          TableName: tableName,
          Key: { publicId }
        })
      );

      if (!shareRes.Item) {
        return res(404, { message: "Share link not found" });
      }

      // Validate JWT
      const token = event.queryStringParameters?.token;
      if (!token) return res(401, { message: "Missing token" });

      let decoded;
      try {
        decoded = jwt.verify(token, JWT_SECRET);
      } catch (e) {
        return res(403, { message: "Invalid or expired token" });
      }

      const { fileId, version, filename, userId } = decoded;

      // Generate S3 URL
      const key = `${userId}/${fileId}/v${version}/${filename}`;
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key
      });

      const signedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });

      return {
        statusCode: 302,
        headers: {
          ...corsHeaders,
          Location: signedUrl
        },
        body: ""
      };
    } catch (err) {
      console.error("GET /share/{publicId} ERROR:", err);
      return res(500, { message: "Internal error", error: err.toString() });
    }
  }

  return res(400, { message: "Invalid request" });
};

// ------------------------------------
function res(code, body) {
  return {
    statusCode: code,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders
    },
    body: JSON.stringify(body)
  };
}