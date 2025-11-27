#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}════════════════════════════════════════${NC}"
echo -e "${BLUE}   Stopping Local Test Environment${NC}"
echo -e "${BLUE}════════════════════════════════════════${NC}"
echo ""

# Read PIDs from file if it exists
if [ -f /tmp/service-pids.txt ]; then
    PIDS=$(cat /tmp/service-pids.txt)
    echo "Stopping services with PIDs: $PIDS"
    
    for PID in $PIDS; do
        if ps -p $PID > /dev/null 2>&1; then
            kill $PID
            echo -e "${GREEN}✓ Stopped process $PID${NC}"
        fi
    done
    
    rm /tmp/service-pids.txt
else
    echo "No PID file found. Stopping services by port..."
    
    # Kill processes by port
    for PORT in 3000 3001 4000; do
        PID=$(lsof -ti :$PORT)
        if [ -n "$PID" ]; then
            kill $PID
            echo -e "${GREEN}✓ Stopped service on port $PORT (PID: $PID)${NC}"
        fi
    done
fi

# Clean up log files
if [ -f /tmp/auth-service.log ]; then
    rm /tmp/auth-service.log
fi

if [ -f /tmp/metadata-service.log ]; then
    rm /tmp/metadata-service.log
fi

if [ -f /tmp/file-mgmt-service.log ]; then
    rm /tmp/file-mgmt-service.log
fi

echo ""
echo -e "${GREEN}✓ All services stopped${NC}"
echo -e "${BLUE}════════════════════════════════════════${NC}"
