const { Stack, Duration, CfnOutput } = require('aws-cdk-lib');
const lambda = require('aws-cdk-lib/aws-lambda');
const apigateway = require('aws-cdk-lib/aws-apigateway');
const dynamodb = require('aws-cdk-lib/aws-dynamodb');

class InfrastructureStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    const usersTable = dynamodb.Table.fromTableName(
      this, 'UsersTable', 'cloud-drive-users'
    );

    const dataTable = dynamodb.Table.fromTableName(
      this, 'DataTable', 'cloud-drive-data'
    );

    const authFunction = new lambda.Function(this, 'AuthFunction', {
      functionName: 'cloud-drive-auth',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'src/lambda.handler',
      code: lambda.Code.fromAsset('../backend'),
      environment: {
        JWT_SECRET: 'super-secret-cloud-drive-key-xyz123'
      },
      timeout: Duration.seconds(30),
      memorySize: 512
    });

    usersTable.grantReadWriteData(authFunction);
    dataTable.grantReadWriteData(authFunction);

    const api = new apigateway.RestApi(this, 'CloudDriveAPI', {
      restApiName: 'cloud-drive-api',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization']
      }
    });

    const auth = api.root.addResource('auth');
    const authProxy = auth.addResource('{proxy+}');
    
    const integration = new apigateway.LambdaIntegration(authFunction);
    authProxy.addMethod('ANY', integration);
    auth.addMethod('ANY', integration);

    new CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'API Gateway URL'
    });
  }
}

module.exports = { InfrastructureStack };