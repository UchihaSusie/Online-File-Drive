#!/bin/bash
# ============================================
# Cloud Drive - Start All Services
# ============================================

echo "🚀 Starting Cloud Drive Services..."
echo ""

# Colors
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Set AWS Profile
export AWS_PROFILE=${AWS_PROFILE:-your-aws-profile} #change to your own AWS profile or it will use the default profile
export AWS_REGION=${AWS_REGION:-us-east-1}
echo -e "${CYAN}Using AWS Profile: $AWS_PROFILE${NC}"
echo -e "${CYAN}Using AWS Region: $AWS_REGION${NC}"
echo ""

# Kill any existing processes on the ports
echo "Cleaning up existing processes..."
lsof -ti:3000 | xargs kill -9 2>/dev/null
lsof -ti:3002 | xargs kill -9 2>/dev/null
lsof -ti:8080 | xargs kill -9 2>/dev/null
sleep 1

# Start Auth Service (Backend)
echo -e "${GREEN}[1/3] Starting Auth Service on port 3000...${NC}"
cd "$SCRIPT_DIR/backend"
npm install --silent 2>/dev/null
node src/index.js > /tmp/auth-service.log 2>&1 &
AUTH_PID=$!
sleep 2

# Start File Management Service
echo -e "${GREEN}[2/3] Starting File Management Service on port 3002...${NC}"
cd "$SCRIPT_DIR/file-management"

# Create .env if not exists
if [ ! -f .env ]; then
    cat > .env << 'EOF'
AUTH_SERVICE_URL=http://localhost:3000
METADATA_SERVICE_URL=http://localhost:3001
PORT=3002
NODE_ENV=development
S3_BUCKET_NAME=6620-cloud-drive-files
AWS_REGION=us-east-1
EOF
    echo "Created .env file"
fi

npm install --silent 2>/dev/null
node src/app.js > /tmp/file-mgmt-service.log 2>&1 &
FILE_PID=$!
sleep 2

# Start Frontend
echo -e "${GREEN}[3/3] Starting Frontend on port 8080...${NC}"
cd "$SCRIPT_DIR/frontend"
python3 -m http.server 8080 > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!
sleep 1

echo ""
echo -e "${CYAN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║           🎉 All Services Started!                        ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Services:${NC}"
echo "  Auth Service:        http://localhost:3000"
echo "  File Management:     http://localhost:3002"
echo "  Metadata Service:    https://votmaqe624.execute-api.us-east-1.amazonaws.com/prod"
echo "  Frontend:            http://localhost:8080"
echo ""
echo -e "${GREEN}Open in browser:${NC}"
echo "  ${CYAN}open http://localhost:8080${NC}"
echo ""
echo -e "${YELLOW}Logs:${NC}"
echo "  Auth:        tail -f /tmp/auth-service.log"
echo "  File Mgmt:   tail -f /tmp/file-mgmt-service.log"
echo "  Frontend:    tail -f /tmp/frontend.log"
echo ""
echo -e "${YELLOW}To stop all services:${NC}"
echo "  kill $AUTH_PID $FILE_PID $FRONTEND_PID"
echo "  # Or run: ./stop-all.sh"
echo ""

# Save PIDs to file for stop script
echo "$AUTH_PID $FILE_PID $FRONTEND_PID" > /tmp/cloud-drive-pids.txt

# Open browser
open http://localhost:8080 2>/dev/null || echo "Open http://localhost:8080 in your browser"

# Keep script running
echo "Press Ctrl+C to stop all services..."
wait

