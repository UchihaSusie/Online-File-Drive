/**
 * Lambda Handler Entry Point
 * 
 * This file wraps the Express app with serverless-http to make it
 * compatible with AWS Lambda and API Gateway.
 * 
 * How it works:
 * 1. API Gateway receives HTTP request
 * 2. Triggers this Lambda function with event data
 * 3. serverless-http converts the event to Express request
 * 4. Express app processes the request
 * 5. serverless-http converts Express response back to API Gateway format
 */

const serverless = require('serverless-http');
const app = require('./app');

// Wrap Express app with serverless-http
// This makes Express compatible with AWS Lambda
const handler = serverless(app, {
    // Binary content types that should be base64 encoded
    binary: ['image/*', 'application/pdf'],
    
    // Request/response transformations
    request: (request, event, context) => {
        // Add Lambda context info if needed
        request.lambdaEvent = event;
        request.lambdaContext = context;
    }
});

// Export the Lambda handler
module.exports.handler = handler;

