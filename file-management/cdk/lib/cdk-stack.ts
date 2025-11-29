import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as logs from 'aws-cdk-lib/aws-logs';

export interface FileManagementStackProps extends cdk.StackProps {
  authServiceUrl?: string;
  metadataServiceUrl?: string;
  jwtSecret?: string;
}

export class CdkStack extends cdk.Stack {
  public readonly fileStorageBucket: s3.Bucket;
  public readonly ecsService: ecs.FargateService;
  public readonly loadBalancer: elbv2.ApplicationLoadBalancer;

  constructor(scope: Construct, id: string, props?: FileManagementStackProps) {
    super(scope, id, props);

    // ========================================
    // S3 Bucket for File Storage
    // ========================================
    this.fileStorageBucket = new s3.Bucket(this, 'FileStorageBucket', {
      bucketName: `6620-cloud-drive-files`,
      versioned: false,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
            s3.HttpMethods.DELETE,
          ],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
          maxAge: 3000,
        },
      ],
      lifecycleRules: [
        {
          id: 'DeleteIncompleteMultipartUploads',
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(7),
        },
      ],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // ========================================
    // Docker Image Asset (CDK builds and pushes automatically)
    // ========================================
    const dockerImage = new cdk.aws_ecr_assets.DockerImageAsset(this, 'FileManagementImage', {
      directory: '../',  // Points to file-management/ directory containing Dockerfile
      platform: cdk.aws_ecr_assets.Platform.LINUX_AMD64,
    });

    // ========================================
    // VPC
    // ========================================
    const vpc = new ec2.Vpc(this, 'FileManagementVpc', {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
    });

    // ========================================
    // ECS Cluster
    // ========================================
    const cluster = new ecs.Cluster(this, 'FileManagementCluster', {
      vpc,
      clusterName: 'file-management-cluster',
      containerInsights: true,
    });

    // ========================================
    // Task Execution Role
    // ========================================
    const taskExecutionRole = new iam.Role(this, 'TaskExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
      ],
    });

    // ========================================
    // Task Role (for application permissions)
    // ========================================
    const taskRole = new iam.Role(this, 'TaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });

    // Grant S3 permissions to task role
    this.fileStorageBucket.grantReadWrite(taskRole);

    // ========================================
    // CloudWatch Log Group
    // ========================================
    const logGroup = new logs.LogGroup(this, 'FileManagementLogGroup', {
      logGroupName: '/ecs/file-management-service',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ========================================
    // Task Definition
    // ========================================
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'TaskDefinition', {
      memoryLimitMiB: 512,
      cpu: 256,
      executionRole: taskExecutionRole,
      taskRole: taskRole,
    });

    // Environment variables
    const environment: { [key: string]: string } = {
      NODE_ENV: 'production',
      PORT: '3002',
      AWS_REGION: this.region,
      S3_BUCKET_NAME: this.fileStorageBucket.bucketName,
      MAX_FILE_SIZE: '104857600', // 100MB
      MAX_VERSIONS: '3',
      PRESIGNED_URL_EXPIRY: '3600',
    };

    // Add optional service URLs and JWT secret if provided via props
    if (props?.authServiceUrl) {
      environment.AUTH_SERVICE_URL = props.authServiceUrl;
    }
    if (props?.metadataServiceUrl) {
      environment.METADATA_SERVICE_URL = props.metadataServiceUrl;
    }
    if (props?.jwtSecret) {
      environment.JWT_SECRET = props.jwtSecret;
    }

    // Container Definition
    // Use Docker image asset (CDK automatically built and pushed this)
    const container = taskDefinition.addContainer('FileManagementContainer', {
      image: ecs.ContainerImage.fromDockerImageAsset(dockerImage),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'file-management',
        logGroup: logGroup,
      }),
      environment,
      healthCheck: {
        command: ['CMD-SHELL', 'node -e "require(\'http\').get(\'http://localhost:3002/health\', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
    });

    container.addPortMappings({
      containerPort: 3002,
      protocol: ecs.Protocol.TCP,
    });

    // ========================================
    // Application Load Balancer
    // ========================================
    this.loadBalancer = new elbv2.ApplicationLoadBalancer(this, 'LoadBalancer', {
      vpc,
      internetFacing: true,
      loadBalancerName: 'file-management-alb',
    });

    const listener = this.loadBalancer.addListener('HttpListener', {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
    });

    // ========================================
    // ECS Fargate Service
    // ========================================
    this.ecsService = new ecs.FargateService(this, 'FileManagementService', {
      cluster,
      taskDefinition,
      serviceName: 'file-management-service',
      desiredCount: 1,
      assignPublicIp: false,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      healthCheckGracePeriod: cdk.Duration.seconds(60),
      circuitBreaker: {
        rollback: true,
      },
    });

    // Target Group
    const targetGroup = listener.addTargets('FileManagementTargets', {
      port: 3002,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [this.ecsService],
      healthCheck: {
        path: '/health',
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
      deregistrationDelay: cdk.Duration.seconds(30),
    });

    // Auto Scaling
    const scaling = this.ecsService.autoScaleTaskCount({
      minCapacity: 1,
      maxCapacity: 10,
    });

    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 70,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    scaling.scaleOnMemoryUtilization('MemoryScaling', {
      targetUtilizationPercent: 80,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    // ========================================
    // Outputs
    // ========================================
    new cdk.CfnOutput(this, 'LoadBalancerDNS', {
      value: this.loadBalancer.loadBalancerDnsName,
      description: 'Load Balancer DNS Name',
      exportName: 'FileManagementServiceUrl',
    });

    new cdk.CfnOutput(this, 'ServiceUrl', {
      value: `http://${this.loadBalancer.loadBalancerDnsName}`,
      description: 'File Management Service URL',
    });

    new cdk.CfnOutput(this, 'S3BucketName', {
      value: this.fileStorageBucket.bucketName,
      description: 'S3 Bucket for file storage',
      exportName: 'FileStorageBucketName',
    });

    new cdk.CfnOutput(this, 'DockerImageUri', {
      value: dockerImage.imageUri,
      description: 'Docker Image URI (CDK-managed ECR)',
    });
  }
}
