const { Stack } = require('aws-cdk-lib');
const dynamodb = require('aws-cdk-lib/aws-dynamodb');
const lambda = require('aws-cdk-lib/aws-lambda');
const apigateway = require('aws-cdk-lib/aws-apigateway');
const iam = require('aws-cdk-lib/aws-iam');
const { Construct } = require('constructs');

class ShareServiceStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    // ---- DynamoDB ----
    const shareTable = new dynamodb.Table(this, 'ShareTable', {
      partitionKey: { name: 'publicId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST
    });

    const fileServiceUrl = this.node.tryGetContext("FILE_SERVICE_URL");
    const bucketName = this.node.tryGetContext("BUCKET_NAME");

    // ---- Lambda ----
    const shareHandler = new lambda.Function(this, 'ShareHandler', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda'),
      environment: {
        TABLE_NAME: shareTable.tableName,
        FILE_SERVICE_URL: fileServiceUrl,
        BUCKET_NAME: bucketName,
        JWT_SECRET: this.node.tryGetContext("JWT_SECRET"),
        BUCKET_REGION: this.node.tryGetContext("BUCKET_REGION"),
      }
    });

    shareTable.grantReadWriteData(shareHandler);

    shareHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["s3:GetObject"],
        resources: [`arn:aws:s3:::${bucketName}/*`]
      })
    );

    // ---- API Gateway ----
    const api = new apigateway.RestApi(this, 'ShareApi', {
      restApiName: 'ShareService',
      description: 'Public file sharing service.',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'Authorization',
          'x-user-id',
          'X-User-Id',
          'X-Amz-Date',
          'X-Api-Key',
          'X-Amz-Security-Token'
        ]
      },
      deployOptions: { stageName: 'prod' }
    });

    const shareResource = api.root.addResource('share');

    shareResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(shareHandler)
    );

    const publicIdResource = shareResource.addResource('{publicId}');

    publicIdResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(shareHandler)
    );
  }
}

module.exports = { ShareServiceStack };