#!/usr/bin/env node
/**
 * CDK Application Entry Point
 * 
 * This file is executed when you run `cdk deploy`.
 * It creates the MetadataServiceStack which includes:
 * - DynamoDB table for file metadata
 * - Lambda function running Express app
 * - API Gateway for HTTP endpoints
 */

import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { MetadataServiceStack } from '../lib/metadata-stack';

// Create CDK App
const app = new cdk.App();

// Create the Metadata Service Stack
new MetadataServiceStack(app, 'MetadataServiceStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
  
  description: 'Metadata and Search Service for Cloud Drive - Lambda + API Gateway + DynamoDB',
  
  tags: {
    Project: 'CloudDrive',
    Service: 'MetadataService',
    Team: '6620',
  },
});

// Synthesize CloudFormation template
app.synth();
