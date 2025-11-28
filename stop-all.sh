#!/bin/bash
# ============================================
# Cloud Drive - Stop All Services
# ============================================

echo "Stopping all Cloud Drive services..."

# Read PIDs from file
if [ -f /tmp/cloud-drive-pids.txt ]; then
    PIDS=$(cat /tmp/cloud-drive-pids.txt)
    kill $PIDS 2>/dev/null
    rm /tmp/cloud-drive-pids.txt
fi

# Also kill by port
lsof -ti:3000 | xargs kill -9 2>/dev/null
lsof -ti:3002 | xargs kill -9 2>/dev/null
lsof -ti:8080 | xargs kill -9 2>/dev/null

echo "✅ All services stopped"

