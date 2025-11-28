#!/bin/bash
# ============================================
# Metadata + Search Service - Local Development
# ============================================
#
# Starts the service locally for development and testing.
# 
# Prerequisites:
#   - AWS credentials configured (for DynamoDB access)
#   - DynamoDB table exists (deploy to AWS first, or use DynamoDB Local)
#
# Usage:
#   ./scripts/local-start.sh
#
# ============================================

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"

cd "$PROJECT_DIR"

# Set environment
export NODE_ENV=development
export PORT=3001
export AWS_REGION=${AWS_REGION:-us-east-1}
export TABLE_NAME=${TABLE_NAME:-cloud-drive-files}

echo ""
echo -e "${CYAN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║       Metadata + Search Service - Local Development       ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check dependencies
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    npm install
fi

echo -e "${GREEN}Starting server on port $PORT...${NC}"
echo -e "${GREEN}DynamoDB Table: $TABLE_NAME${NC}"
echo -e "${GREEN}AWS Region: $AWS_REGION${NC}"
echo ""
echo -e "${GREEN}🔗 Available Endpoints:${NC}"
echo ""
echo "   ${CYAN}Health:${NC}"
echo "   GET  http://localhost:$PORT/health"
echo ""
echo "   ${CYAN}File Metadata:${NC}"
echo "   POST/GET/PUT/DELETE http://localhost:$PORT/api/metadata"
echo ""
echo "   ${CYAN}Folder Metadata Management:${NC}"
echo "   POST   http://localhost:$PORT/api/folders              - Create folder"
echo "   GET    http://localhost:$PORT/api/folders?userId=      - List folders"
echo "   GET    http://localhost:$PORT/api/folders/:id          - Get folder info"
echo "   GET    http://localhost:$PORT/api/folders/:id/content  - List contents"
echo "   POST   http://localhost:$PORT/api/folders/:id/move     - Move folder"
echo "   DELETE http://localhost:$PORT/api/folders/:id          - Delete folder"
echo ""
echo "   ${CYAN}Search & Sort:${NC}"
echo "   GET  http://localhost:$PORT/api/files/search?q={keyword}"
echo "   GET  http://localhost:$PORT/api/files/search/by-type?type={type}"
echo "   GET  http://localhost:$PORT/api/files/search/recent"
echo "   GET  http://localhost:$PORT/api/files/search/stats"
echo "   GET  http://localhost:$PORT/api/files/search/list?sortBy=name&sortDirection=asc"
echo "   GET  http://localhost:$PORT/api/files/search/sort-options"
echo ""
echo -e "${YELLOW}Sorting Parameters:${NC}"
echo "   sortBy:        name | updatedAt | createdAt | size | type"
echo "   sortDirection: asc | desc"
echo ""

# Start the server
node src/app.js

