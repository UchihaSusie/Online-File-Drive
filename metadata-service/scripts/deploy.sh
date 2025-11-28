#!/bin/bash
# ============================================
# Metadata + Search Service - AWS Deployment Script
# ============================================
#
# This script deploys the Metadata Service to AWS using CDK.
# It creates: DynamoDB Table + Lambda Function + API Gateway
#
# Usage:
#   ./scripts/deploy.sh          # Deploy to AWS
#   ./scripts/deploy.sh destroy  # Remove all AWS resources
#
# Prerequisites:
#   - Node.js >= 18
#   - AWS CLI configured (aws configure)
#   - AWS CDK installed (npm install -g aws-cdk)
#
# ============================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Get script directory (metadata-service root)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"

# Set AWS region - using us-east-1 to match Auth Service
export AWS_REGION=${AWS_REGION:-us-east-1}
export CDK_DEFAULT_REGION=$AWS_REGION

echo ""
echo -e "${CYAN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║       Metadata + Search Service - AWS Deployment          ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""

# ============================================
# Check Prerequisites
# ============================================
echo -e "${BLUE}[Step 1/5] Checking prerequisites...${NC}"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js >= 18${NC}"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}❌ Node.js version must be >= 18. Current: $(node -v)${NC}"
    exit 1
fi
echo -e "  ${GREEN}✓${NC} Node.js $(node -v)"

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI is not installed${NC}"
    exit 1
fi
echo -e "  ${GREEN}✓${NC} AWS CLI installed"

# Check AWS credentials
export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text 2>/dev/null)
if [ -z "$CDK_DEFAULT_ACCOUNT" ]; then
    echo -e "${RED}❌ AWS credentials not configured. Run 'aws configure'${NC}"
    exit 1
fi
echo -e "  ${GREEN}✓${NC} AWS Account: $CDK_DEFAULT_ACCOUNT"
echo -e "  ${GREEN}✓${NC} AWS Region: $AWS_REGION"

# Check CDK
if ! command -v cdk &> /dev/null; then
    echo -e "${YELLOW}⚠️  AWS CDK not found. Installing...${NC}"
    npm install -g aws-cdk
fi
echo -e "  ${GREEN}✓${NC} AWS CDK $(cdk --version | cut -d' ' -f1)"
echo ""

# ============================================
# Handle destroy command
# ============================================
if [ "$1" == "destroy" ]; then
    echo -e "${YELLOW}⚠️  This will DELETE all resources:${NC}"
    echo "    - DynamoDB Table (cloud-drive-files) and ALL DATA"
    echo "    - Lambda Function (metadata-service)"
    echo "    - API Gateway"
    echo ""
    read -p "Are you sure? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        echo "Cancelled."
        exit 0
    fi
    
    cd "$PROJECT_DIR/cdk"
    npm install --silent
    npm run build
    cdk destroy --force
    
    echo ""
    echo -e "${GREEN}✅ All resources destroyed${NC}"
    exit 0
fi

# ============================================
# Install Dependencies
# ============================================
echo -e "${BLUE}[Step 2/5] Installing dependencies...${NC}"

# Install Lambda function dependencies
cd "$PROJECT_DIR"
if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
    echo "  Installing Lambda dependencies..."
    npm install --silent
else
    echo -e "  ${GREEN}✓${NC} Lambda dependencies already installed"
fi

# Install CDK dependencies
cd "$PROJECT_DIR/cdk"
if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
    echo "  Installing CDK dependencies..."
    npm install --silent
else
    echo -e "  ${GREEN}✓${NC} CDK dependencies already installed"
fi
echo ""

# ============================================
# Bootstrap CDK (if needed)
# ============================================
echo -e "${BLUE}[Step 3/5] Checking CDK bootstrap...${NC}"

if ! aws cloudformation describe-stacks --stack-name CDKToolkit --region $AWS_REGION >/dev/null 2>&1; then
    echo "  CDK not bootstrapped in $AWS_REGION. Bootstrapping..."
    cdk bootstrap aws://$CDK_DEFAULT_ACCOUNT/$AWS_REGION
else
    echo -e "  ${GREEN}✓${NC} CDK already bootstrapped"
fi
echo ""

# ============================================
# Build and Deploy
# ============================================
echo -e "${BLUE}[Step 4/5] Building TypeScript...${NC}"
npm run build
echo -e "  ${GREEN}✓${NC} Build complete"
echo ""

echo -e "${BLUE}[Step 5/5] Deploying to AWS...${NC}"
echo "  This may take 2-5 minutes..."
echo ""

cdk deploy --require-approval never --outputs-file "$PROJECT_DIR/outputs.json"

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Deployment failed${NC}"
    exit 1
fi

# ============================================
# Get Outputs
# ============================================
API_URL=$(aws cloudformation describe-stacks \
    --stack-name MetadataServiceStack \
    --region $AWS_REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
    --output text)

API_URL_NO_SLASH=$(echo $API_URL | sed 's:/*$::')

TABLE_NAME=$(aws cloudformation describe-stacks \
    --stack-name MetadataServiceStack \
    --region $AWS_REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`TableName`].OutputValue' \
    --output text)

# ============================================
# Deployment Summary
# ============================================
echo ""
echo -e "${CYAN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║              🎉 Deployment Successful!                    ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}📍 API URL:${NC}"
echo "   $API_URL_NO_SLASH"
echo ""
echo -e "${GREEN}📊 Resources Created:${NC}"
echo "   • DynamoDB Table: $TABLE_NAME"
echo "   • Lambda Function: metadata-service"
echo "   • API Gateway: Metadata Search Service API"
echo ""
echo -e "${GREEN}🔗 Endpoints:${NC}"
echo "   Health Check:     GET  $API_URL_NO_SLASH/health"
echo ""
echo "   ${CYAN}File Metadata APIs:${NC}"
echo "   Create Metadata:  POST $API_URL_NO_SLASH/api/metadata"
echo "   Get Metadata:     GET  $API_URL_NO_SLASH/api/metadata/{fileId}"
echo ""
echo "   ${CYAN}Folder Metadata APIs:${NC}"
echo "   Create Folder:    POST $API_URL_NO_SLASH/api/folders"
echo "   List Folders:     GET  $API_URL_NO_SLASH/api/folders?userId={userId}"
echo "   Get Folder:       GET  $API_URL_NO_SLASH/api/folders/{folderId}"
echo "   Folder Content:   GET  $API_URL_NO_SLASH/api/folders/{folderId}/content"
echo "   Move Folder:      POST $API_URL_NO_SLASH/api/folders/{folderId}/move"
echo "   Delete Folder:    DELETE $API_URL_NO_SLASH/api/folders/{folderId}"
echo ""
echo "   ${CYAN}Search APIs:${NC}"
echo "   Search Keyword:   GET  $API_URL_NO_SLASH/api/files/search?q={keyword}"
echo "   Search by Type:   GET  $API_URL_NO_SLASH/api/files/search/by-type?type={type}"
echo "   Recent Files:     GET  $API_URL_NO_SLASH/api/files/search/recent"
echo "   File Stats:       GET  $API_URL_NO_SLASH/api/files/search/stats"
echo "   List with Sort:   GET  $API_URL_NO_SLASH/api/files/search/list?sortBy=name"
echo ""
echo -e "${YELLOW}📋 Next Steps for Team Integration:${NC}"
echo ""
echo "   1. Share this URL with your team:"
echo "      ${CYAN}METADATA_SERVICE_URL=$API_URL_NO_SLASH${NC}"
echo ""
echo "   2. Test health check:"
echo "      ${CYAN}curl $API_URL_NO_SLASH/health${NC}"
echo ""
echo "   3. Update file-management .env:"
echo "      ${CYAN}echo \"METADATA_SERVICE_URL=$API_URL_NO_SLASH\" >> ../file-management/.env${NC}"
echo ""
echo -e "${GREEN}📂 Test Folder API:${NC}"
echo "   # Create folder"
echo "   curl -X POST $API_URL_NO_SLASH/api/folders \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -H 'Authorization: Bearer \$TOKEN' \\"
echo "     -d '{\"folderId\":\"test-folder\",\"userId\":\"\$USER_ID\",\"name\":\"Photos\",\"parentId\":\"root\"}'"
echo ""
echo "   # List folder content"
echo "   curl \"\$API_URL/api/folders/root/content?userId=\$USER_ID\" -H 'Authorization: Bearer \$TOKEN'"
echo ""
echo -e "${GREEN}📜 View Lambda Logs:${NC}"
echo "   aws logs tail /aws/lambda/metadata-service --follow --region $AWS_REGION"
echo ""
echo -e "${GREEN}🗑️  To destroy resources:${NC}"
echo "   ./scripts/deploy.sh destroy"
echo ""

