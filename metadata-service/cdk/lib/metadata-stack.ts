import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as path from 'path';

/**
 * 
 * 1. DynamoDB Table (cloud-drive-files)
 *    - Primary Key: fileId (String)
 *    - GSI: userId-createdAt-index for efficient user queries and time-based searches
 * 
 * 2. Lambda Function
 *    - Runtime: Node.js 18.x
 *    - Handles all API requests via Express + serverless-http
 * 
 * 3. API Gateway (REST API)
 *    - Endpoints for Metadata CRUD and Search operations
 *    - CORS enabled for browser access
 * 
 * 4. IAM Roles & Permissions
 *    - Lambda execution role with DynamoDB access
 */
export class MetadataServiceStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;
  public readonly table: dynamodb.Table;
  public readonly lambdaFunction: lambda.Function;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ============================================
    // DynamoDB Table: cloud-drive-files
    // ============================================
    // This table stores all file metadata for the Cloud Drive application.
    // Uses fileId as primary key for direct lookups.
    // GSI enables efficient queries by userId with time-based sorting.
    
    this.table = new dynamodb.Table(this, 'CloudDriveFilesTable', {
      tableName: 'cloud-drive-files',
      
      partitionKey: {
        name: 'fileId',
        type: dynamodb.AttributeType.STRING
      },

      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      
      pointInTimeRecovery: true,
      
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Global Secondary Index: userId-createdAt-index
    // Used for:
    // - Listing all files for a user
    // - Time-based queries (recent files)
    // - Sorting files by upload date
    this.table.addGlobalSecondaryIndex({
      indexName: 'userId-createdAt-index',
      partitionKey: {
        name: 'userId',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'createdAt',
        type: dynamodb.AttributeType.STRING
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // ============================================
    // CloudWatch Log Group
    // ============================================
    const logGroup = new logs.LogGroup(this, 'MetadataServiceLogs', {
      logGroupName: '/aws/lambda/metadata-service',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ============================================
    // Lambda Execution Role
    // ============================================
    const lambdaRole = new iam.Role(this, 'MetadataLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'Execution role for Metadata Service Lambda',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });
    this.table.grantReadWriteData(lambdaRole);

    // ============================================
    // Lambda Function
    // ============================================
    
    this.lambdaFunction = new lambda.Function(this, 'MetadataServiceFunction', {
      functionName: 'metadata-service',
      description: 'Metadata and Search Service for Cloud Drive',
      
      runtime: lambda.Runtime.NODEJS_18_X,

      handler: 'src/lambda.handler',
      
      code: lambda.Code.fromAsset(path.join(__dirname, '../..'), {
        // Exclude unnecessary files to reduce deployment package size
        exclude: [
          'cdk',
          'cdk/**',
          'scripts',
          'scripts/**',
          '*.md',
          '*.sh',
          '.git',
          '.git/**',
          '.gitignore',
          'outputs.json',
          '*.log'
        ]
      }),
      
      role: lambdaRole,
      
      environment: {
        TABLE_NAME: this.table.tableName,
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
        NODE_ENV: 'production',
      },
      
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      
      tracing: lambda.Tracing.ACTIVE,
      
      logGroup: logGroup,
    });

    // ============================================
    // API Gateway REST API
    // ============================================
    this.api = new apigateway.RestApi(this, 'MetadataServiceApi', {
      restApiName: 'Metadata Search Service API',
      description: 'API for file metadata management and search functionality',
      
      deployOptions: {
        stageName: 'prod',
        accessLogDestination: new apigateway.LogGroupLogDestination(logGroup),
        accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields(),
        throttlingRateLimit: 100,
        throttlingBurstLimit: 200,
      },
      
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      },
    });

    // Lambda integration for API Gateway
    const lambdaIntegration = new apigateway.LambdaIntegration(this.lambdaFunction, {
      proxy: true, // Use proxy integration for full request/response passthrough
    });

    // ============================================
    // API Routes
    // ============================================
    
    // Health check endpoint (no auth required)
    // GET /health
    const healthResource = this.api.root.addResource('health');
    healthResource.addMethod('GET', lambdaIntegration);

    // /api resource
    const apiResource = this.api.root.addResource('api');

    // ============================================
    // Metadata Routes: /api/metadata
    // ============================================
    const metadataResource = apiResource.addResource('metadata');
    
    // POST /api/metadata - Create metadata
    metadataResource.addMethod('POST', lambdaIntegration);
    
    // GET /api/metadata - List user's files
    metadataResource.addMethod('GET', lambdaIntegration);
    
    // /api/metadata/{fileId}
    const fileResource = metadataResource.addResource('{fileId}');
    
    // GET /api/metadata/{fileId} - Get single file
    fileResource.addMethod('GET', lambdaIntegration);
    
    // PUT /api/metadata/{fileId} - Update metadata
    fileResource.addMethod('PUT', lambdaIntegration);
    
    // DELETE /api/metadata/{fileId} - Delete metadata
    fileResource.addMethod('DELETE', lambdaIntegration);

    // ============================================
    // Search Routes: /api/files/search
    // ============================================
    const filesResource = apiResource.addResource('files');
    const searchResource = filesResource.addResource('search');
    
    // GET /api/files/search?q={keyword} - Search by keyword
    searchResource.addMethod('GET', lambdaIntegration);
    
    // GET /api/files/search/by-type?type={type} - Search by type
    const byTypeResource = searchResource.addResource('by-type');
    byTypeResource.addMethod('GET', lambdaIntegration);
    
    // GET /api/files/search/recent - Get recent files
    const recentResource = searchResource.addResource('recent');
    recentResource.addMethod('GET', lambdaIntegration);
    
    // GET /api/files/search/stats - Get file statistics
    const statsResource = searchResource.addResource('stats');
    statsResource.addMethod('GET', lambdaIntegration);
    
    // GET /api/files/search/list - List files with sorting
    const listResource = searchResource.addResource('list');
    listResource.addMethod('GET', lambdaIntegration);
    
    // GET /api/files/search/sort-options - Get available sort options
    const sortOptionsResource = searchResource.addResource('sort-options');
    sortOptionsResource.addMethod('GET', lambdaIntegration);

    // ============================================
    // Stack Outputs
    // ============================================
    
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.api.url,
      description: 'Metadata Service API URL',
      exportName: 'MetadataServiceApiUrl',
    });

    new cdk.CfnOutput(this, 'ApiUrlWithoutTrailingSlash', {
      value: this.api.url.replace(/\/$/, ''),
      description: 'API URL without trailing slash (for METADATA_SERVICE_URL)',
    });

    new cdk.CfnOutput(this, 'TableName', {
      value: this.table.tableName,
      description: 'DynamoDB Table Name',
      exportName: 'CloudDriveFilesTableName',
    });

    new cdk.CfnOutput(this, 'LambdaFunctionName', {
      value: this.lambdaFunction.functionName,
      description: 'Lambda Function Name',
    });

    new cdk.CfnOutput(this, 'HealthCheckUrl', {
      value: `${this.api.url}health`,
      description: 'Health check endpoint',
    });

    // Output all search endpoints for reference
    new cdk.CfnOutput(this, 'SearchEndpoints', {
      value: JSON.stringify({
        searchByKeyword: `${this.api.url}api/files/search?q={keyword}&sortBy=name&sortDirection=asc`,
        searchByType: `${this.api.url}api/files/search/by-type?type={type}`,
        recentFiles: `${this.api.url}api/files/search/recent`,
        stats: `${this.api.url}api/files/search/stats`,
        listWithSort: `${this.api.url}api/files/search/list?sortBy=name&sortDirection=asc`,
        sortOptions: `${this.api.url}api/files/search/sort-options`,
      }),
      description: 'Search API endpoints',
    });
  }
}
