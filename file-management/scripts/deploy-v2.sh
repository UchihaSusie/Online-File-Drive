#!/bin/bash
set -e

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# Navigate to file-management root (parent of scripts/)
cd "$SCRIPT_DIR/.."

echo "🚀 Starting File Management Service Deployment..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Set variables
export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text 2>/dev/null)
export CDK_DEFAULT_REGION=${AWS_REGION:-us-west-2}

if [ -z "$CDK_DEFAULT_ACCOUNT" ]; then
    echo -e "${RED}❌ Error: Unable to get AWS account ID. Please configure AWS CLI.${NC}"
    exit 1
fi

echo -e "${GREEN}📦 AWS Account: $CDK_DEFAULT_ACCOUNT${NC}"
echo -e "${GREEN}🌍 Region: $CDK_DEFAULT_REGION${NC}"
echo ""

# ========================================
# PHASE 1: Deploy ECR Repository
# ========================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}   PHASE 1: Deploy ECR Repository${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

cd cdk
npm install --silent
npm run build

echo "☁️  Deploying ECR stack..."
cdk deploy FileManagementEcrStack --require-approval never

ECR_URI=$(aws ecr describe-repositories --repository-names file-management-service --region $CDK_DEFAULT_REGION --query 'repositories[0].repositoryUri' --output text)
echo -e "${GREEN}🐳 ECR Repository: $ECR_URI${NC}"
cd ..
echo ""

echo -e "${GREEN}✅ Phase 1 Complete${NC}"
echo ""

# ========================================
# PHASE 2: Build and Push Docker Image
# ========================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}   PHASE 2: Build and Push Docker Image to ECR${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Build Docker image
echo "🏗️  Building Docker image (platform: linux/amd64)..."
docker build -t file-management-service . --platform linux/amd64

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Docker build failed${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Docker image built${NC}"
echo ""

# Login to ECR
echo "🔐 Logging in to ECR..."
aws ecr get-login-password --region $CDK_DEFAULT_REGION | \
  docker login --username AWS --password-stdin $(echo $ECR_URI | cut -d'/' -f1) > /dev/null 2>&1

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ ECR login failed${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Logged in to ECR${NC}"
echo ""

# Tag image
echo "🏷️  Tagging Docker image..."
docker tag file-management-service:latest $ECR_URI:latest
echo ""

# Push to ECR
echo "📤 Pushing Docker image to ECR..."
docker push $ECR_URI:latest

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Docker push failed${NC}"
    exit 1
fi
echo ""
echo -e "${GREEN}✅ Phase 2 Complete: Image pushed to ECR${NC}"
echo ""

# ========================================
# PHASE 3: Deploy Full Infrastructure
# ========================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}   PHASE 3: Deploy Full Infrastructure${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo "☁️  Deploying ECS, VPC, S3, and Load Balancer..."
cd cdk
cdk deploy FileManagementStack --require-approval never

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ CDK deployment failed${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Phase 3 Complete: Infrastructure deployed and service starting${NC}"
echo ""

# ========================================
# Deployment Summary
# ========================================
# Get service URL and S3 bucket
SERVICE_URL=$(aws cloudformation describe-stacks \
  --stack-name FileManagementStack \
  --region $CDK_DEFAULT_REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`ServiceUrl`].OutputValue' \
  --output text)

S3_BUCKET=$(aws cloudformation describe-stacks \
  --stack-name FileManagementStack \
  --region $CDK_DEFAULT_REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`S3BucketName`].OutputValue' \
  --output text)
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}📋 Deployment Summary${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}🌐 Service URL:${NC} $SERVICE_URL"
echo -e "${GREEN}📝 Health Check:${NC} $SERVICE_URL/health"
echo -e "${GREEN}🪣 S3 Bucket:${NC} $S3_BUCKET"
echo -e "${GREEN}🐳 ECR Repository:${NC} $ECR_URI"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${YELLOW}⏳ Note: Service may take 2-3 minutes to become healthy${NC}"
echo ""
echo "📊 Monitor deployment:"
echo "  aws ecs describe-services --cluster file-management-cluster --services file-management-service --region $CDK_DEFAULT_REGION"
echo ""
echo "📜 View logs:"
echo "  aws logs tail /ecs/file-management-service --follow --region $CDK_DEFAULT_REGION"
echo ""
echo "🔍 Check service health:"
echo "  watch -n 5 'curl -s $SERVICE_URL/health | jq'"
