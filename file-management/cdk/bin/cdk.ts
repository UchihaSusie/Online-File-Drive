#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { CdkStack } from '../lib/cdk-stack';

const app = new cdk.App();

const env = { 
  account: process.env.CDK_DEFAULT_ACCOUNT, 
  region: process.env.CDK_DEFAULT_REGION || 'us-west-2'
};

// Get configuration from context or environment
const authServiceUrl = app.node.tryGetContext('authServiceUrl') || process.env.AUTH_SERVICE_URL;
const metadataServiceUrl = app.node.tryGetContext('metadataServiceUrl') || process.env.METADATA_SERVICE_URL;
const jwtSecret = app.node.tryGetContext('jwtSecret') || process.env.JWT_SECRET || 'super-secret-cloud-drive-key-xyz123';

// Single stack with DockerImageAsset (CDK handles ECR creation and image push automatically)
new CdkStack(app, 'FileManagementStack', {
  env,
  authServiceUrl,
  metadataServiceUrl,
  jwtSecret,
  description: 'File Management Service Stack - ECS, ECR, S3, VPC',
});