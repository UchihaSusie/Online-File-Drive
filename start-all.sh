#!/bin/bash
# ============================================
# Cloud Drive - Start Frontend
# All backend services are deployed on AWS
# ============================================

echo "🚀 Starting Cloud Drive Frontend..."
echo ""

# Colors
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Set AWS Profile (for reference, not needed for frontend)
export AWS_PROFILE=${AWS_PROFILE:-your-aws-profile}
export AWS_REGION=${AWS_REGION:-us-east-1}
echo -e "${CYAN}Using AWS Profile: $AWS_PROFILE${NC}"
echo -e "${CYAN}Using AWS Region: $AWS_REGION${NC}"
echo ""

# Kill any existing processes on port 8080
echo "Cleaning up existing processes..."
lsof -ti:8080 | xargs kill -9 2>/dev/null
sleep 1

# All backend services are deployed to AWS
echo -e "${YELLOW}[Info] All backend services are running on AWS:${NC}"
echo -e "${CYAN}  • Auth Service:        https://w1vjy3spoj.execute-api.us-east-1.amazonaws.com/prod${NC}"
echo -e "${CYAN}  • File Management:     http://file-management-alb-797118415.us-west-2.elb.amazonaws.com${NC}"
echo -e "${CYAN}  • Metadata Service:   https://votmaqe624.execute-api.us-east-1.amazonaws.com/prod${NC}"
echo ""

# Start Frontend only
echo -e "${GREEN}[1/1] Starting Frontend on port 8080...${NC}"
cd "$SCRIPT_DIR/frontend"
python3 -m http.server 8080 > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!
sleep 1

echo ""
echo -e "${CYAN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║           🎉 Frontend Started!                             ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Services:${NC}"
echo "  Auth Service:        https://w1vjy3spoj.execute-api.us-east-1.amazonaws.com/prod"
echo "  File Management:     http://file-management-alb-797118415.us-west-2.elb.amazonaws.com"
echo "  Metadata Service:    https://votmaqe624.execute-api.us-east-1.amazonaws.com/prod"
echo "  Frontend:            http://localhost:8080"
echo ""
echo -e "${GREEN}Open in browser:${NC}"
echo "  ${CYAN}open http://localhost:8080${NC}"
echo ""
echo -e "${YELLOW}Logs:${NC}"
echo "  Frontend:    tail -f /tmp/frontend.log"
echo ""
echo -e "${YELLOW}To stop frontend:${NC}"
echo "  kill $FRONTEND_PID"
echo "  # Or run: ./stop-all.sh"
echo ""

# Save PID to file for stop script
echo "$FRONTEND_PID" > /tmp/cloud-drive-pids.txt

# Open browser
open http://localhost:8080 2>/dev/null || echo "Open http://localhost:8080 in your browser"

# Keep script running
echo "Press Ctrl+C to stop frontend..."
wait