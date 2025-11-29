# File Management Service - AWS Deployment

AWS CDK infrastructure for deploying the File Management Service to ECS Fargate.

## What Gets Deployed

- **Amazon ECR**: Container registry for Docker images
- **Amazon S3**: File storage bucket (`6620-cloud-drive-files`) with encryption
- **Amazon VPC**: Network with public/private subnets across 2 AZs
- **Amazon ECS Fargate**: Serverless container orchestration (auto-scaling 1-10 tasks)
- **Application Load Balancer**: Public HTTP endpoint with health checks
- **CloudWatch Logs**: Centralized logging (`/ecs/file-management-service`)
- **IAM Roles**: Least-privilege permissions for S3 access

## Prerequisites

- **AWS CLI** configured: `aws configure`
- **Node.js** 18+
- **Docker** installed and running

## Quick Deploy

```bash
cd file-management/scripts
./deploy-v2.sh
```

**Deployment flow:**
1. Creates ECR repository (if doesn't exist)
2. Builds Docker image with `linux/amd64` platform
3. Pushes image to ECR
4. Deploys full infrastructure (S3, VPC, ECS, ALB)
5. ECS service starts with correct image

**Deployment time:** ~10-15 minutes


**For Local Testing:**
Use the included mock metadata service:
```bash
cd scripts/local-test
./start-services.sh
```

This starts mock auth (3000), metadata (3001), and file-management (3002) services.

## Configuration

### Set Environment Variables (Optional)

Update `.env` file before deployment:
```bash
AUTH_SERVICE_URL=http://your-auth-alb-url.elb.amazonaws.com
METADATA_SERVICE_URL=http://your-metadata-alb-url.elb.amazonaws.com
```

The deployment script reads from `.env` and passes to CDK.

### S3 Bucket Name

Set in `lib/cdk-stack.ts`:
```typescript
bucketName: `6620-cloud-drive-files`
```

⚠️ Must be globally unique. Update if deployment fails with bucket conflict.

## After Deployment

### Get Service URL

```bash
SERVICE_URL=$(aws cloudformation describe-stacks \
  --stack-name FileManagementStack --region us-west-2 \
  --query 'Stacks[0].Outputs[?OutputKey==`ServiceUrl`].OutputValue' \
  --output text)

echo $SERVICE_URL
curl $SERVICE_URL/health
```

### API Endpoints

- `POST /api/files/upload` - Upload new file
- `PUT /api/files/:fileId` - Update file (creates new version)
- `GET /api/files/:fileId/download` - Download file
- `GET /api/files/:fileId/versions` - List file versions
- `POST /api/files/:fileId/restore` - Restore previous version
- `DELETE /api/files/:fileId` - Delete file
- `GET /api/files` - List all user files
- `GET /health` - Health check

All endpoints except `/health` require `Authorization: Bearer <token>` header.

## Monitoring

### View Logs
```bash
aws logs tail /ecs/file-management-service --follow --region us-west-2
```

### Check Service Status
```bash
aws ecs describe-services \
  --cluster file-management-cluster \
  --services file-management-service \
  --region us-west-2 \
  --query 'services[0].{desired:desiredCount,running:runningCount,pending:pendingCount}'
```

## Updating the Service

Rebuild and deploy:
```bash
cd file-management/scripts
./deploy-v2.sh
```

This rebuilds the image, pushes to ECR, and forces ECS to update with zero downtime.

## Cleanup

```bash
cd file-management/cdk
cdk destroy
```

Manually delete S3 bucket and ECR images:
```bash
aws s3 rm s3://6620-cloud-drive-files --recursive
aws s3 rb s3://6620-cloud-drive-files
aws ecr delete-repository --repository-name file-management-service --force --region us-west-2
```

## Troubleshooting

**Service not starting:**
```bash
# Check logs
aws logs tail /ecs/file-management-service --region us-west-2

# Check task status
aws ecs list-tasks --cluster file-management-cluster --region us-west-2
aws ecs describe-tasks --cluster file-management-cluster --tasks <task-arn> --region us-west-2
```

**Common Issues:**
- **Image pull errors**: Verify image exists in ECR
- **Health check failing**: Ensure port 3002 is exposed and `/health` endpoint responds
- **Access denied**: Check IAM role has S3 permissions
- **Metadata service unavailable**: Verify `METADATA_SERVICE_URL` is correct and service is accessible
