#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}════════════════════════════════════════${NC}"
echo -e "${BLUE}   Starting Local Test Environment${NC}"
echo -e "${BLUE}════════════════════════════════════════${NC}"

# Function to check if port is in use
check_port() {
    lsof -i :$1 > /dev/null 2>&1
    return $?
}

# Check if ports are available
echo ""
echo "Checking ports..."

if check_port 3000; then
    echo -e "${RED}✗ Port 3000 is already in use${NC}"
    echo "  Run: lsof -ti :3000 | xargs kill -9"
    exit 1
fi

if check_port 3001; then
    echo -e "${RED}✗ Port 3001 is already in use${NC}"
    echo "  Run: lsof -ti :3001 | xargs kill -9"
    exit 1
fi

if check_port 3002; then
    echo -e "${RED}✗ Port 3002 is already in use${NC}"
    echo "  Run: lsof -ti :3002 | xargs kill -9"
    exit 1
fi

echo -e "${GREEN}✓ All ports available${NC}"

# Get the project root directory
PROJECT_ROOT="/Users/qing/Desktop/NEU/0 Course/6620 Cloud Computing/homework/Online-File-Drive"
FILE_MGMT_DIR="$PROJECT_ROOT/file-management"

# Check if .env exists
if [ ! -f "$FILE_MGMT_DIR/.env" ]; then
    echo ""
    echo -e "${BLUE}Creating .env file...${NC}"
    cp "$FILE_MGMT_DIR/.env.local" "$FILE_MGMT_DIR/.env"
    echo -e "${RED}⚠ Please edit $FILE_MGMT_DIR/.env and add your AWS credentials${NC}"
    echo -e "${RED}  Then run this script again.${NC}"
    exit 1
fi

# Start services
echo ""
echo -e "${GREEN}Starting services...${NC}"
echo ""

# Start Auth Service
echo -e "${BLUE}[1/3] Starting Auth Service (port 3000)...${NC}"
cd "$PROJECT_ROOT"
node src/index.js > /tmp/auth-service.log 2>&1 &
AUTH_PID=$!
echo "  PID: $AUTH_PID"

# Wait for auth service to start
sleep 2

# Start Mock Metadata Service
echo -e "${BLUE}[2/3] Starting Mock Metadata Service (port 3001)...${NC}"
cd "$FILE_MGMT_DIR"
node mock-metadata-service.js > /tmp/metadata-service.log 2>&1 &
METADATA_PID=$!
echo "  PID: $METADATA_PID"

# Wait for metadata service to start
sleep 2

# Start File Management Service
echo -e "${BLUE}[3/3] Starting File Management Service (port 3002)...${NC}"
cd "$FILE_MGMT_DIR"
node src/app.js > /tmp/file-mgmt-service.log 2>&1 &
FILE_MGMT_PID=$!
echo "  PID: $FILE_MGMT_PID"

# Wait for all services to start
sleep 3

# Check if services are running
echo ""
echo "Checking service health..."

check_service() {
    response=$(curl -s -o /dev/null -w "%{http_code}" $1)
    if [ "$response" -eq 200 ]; then
        echo -e "${GREEN}✓ $2 is healthy${NC}"
        return 0
    else
        echo -e "${RED}✗ $2 failed to start${NC}"
        return 1
    fi
}

check_service "http://localhost:3000/health" "Auth Service"
AUTH_OK=$?

check_service "http://localhost:3001/health" "Metadata Service"
METADATA_OK=$?

check_service "http://localhost:3002/health" "File Management Service"
FILE_OK=$?

echo ""
echo -e "${BLUE}════════════════════════════════════════${NC}"

if [ $AUTH_OK -eq 0 ] && [ $METADATA_OK -eq 0 ] && [ $FILE_OK -eq 0 ]; then
    echo -e "${GREEN}✓ All services started successfully!${NC}"
    echo ""
    echo "Service URLs:"
    echo "  • Auth:     http://localhost:3000"
    echo "  • Metadata: http://localhost:3001"
    echo "  • Files:    http://localhost:3002"
    echo ""
    echo "Logs:"
    echo "  • Auth:     tail -f /tmp/auth-service.log"
    echo "  • Metadata: tail -f /tmp/metadata-service.log"
    echo "  • Files:    tail -f /tmp/file-mgmt-service.log"
    echo ""
    echo "To stop all services:"
    echo "  ./stop-services.sh"
    echo "  or: kill $AUTH_PID $METADATA_PID $FILE_MGMT_PID"
    echo ""
    
    # Save PIDs to file for stop script
    echo "$AUTH_PID $METADATA_PID $FILE_MGMT_PID" > /tmp/service-pids.txt
else
    echo -e "${RED}✗ Some services failed to start${NC}"
    echo ""
    echo "Check logs:"
    echo "  tail -f /tmp/auth-service.log"
    echo "  tail -f /tmp/metadata-service.log"
    echo "  tail -f /tmp/file-mgmt-service.log"
    
    # Kill all started services
    kill $AUTH_PID $METADATA_PID $FILE_MGMT_PID 2>/dev/null
fi

echo -e "${BLUE}════════════════════════════════════════${NC}"
