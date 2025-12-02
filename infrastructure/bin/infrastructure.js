#!/usr/bin/env node
const cdk = require('aws-cdk-lib');
const { InfrastructureStack } = require('../lib/infrastructure-stack');

const app = new cdk.App();
new InfrastructureStack(app, 'CloudDriveStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'us-east-1'
  }
});