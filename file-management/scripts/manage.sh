#!/bin/bash

# File Management Service - Helper Script
# Common operations for managing the deployed service

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

STACK_NAME="FileManagementStack"
CLUSTER_NAME="file-management-cluster"
SERVICE_NAME="file-management-service"
REPO_NAME="file-management-service"

# Show usage
show_usage() {
    echo "File Management Service Helper"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  status          Show service status"
    echo "  logs            Tail service logs"
    echo "  outputs         Show stack outputs"
    echo "  scale [count]   Scale service to [count] tasks"
    echo "  restart         Restart service"
    echo "  health          Check service health"
    echo "  tasks           List running tasks"
    echo "  images          List ECR images"
    echo "  cost            Show cost estimate"
    echo "  cleanup         Cleanup unused resources"
    echo ""
}

# Get stack outputs
get_output() {
    aws cloudformation describe-stacks \
        --stack-name $STACK_NAME \
        --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" \
        --output text 2>/dev/null
}

# Show service status
show_status() {
    echo -e "${GREEN}Service Status:${NC}"
    aws ecs describe-services \
        --cluster $CLUSTER_NAME \
        --services $SERVICE_NAME \
        --query 'services[0].{Status:status,Running:runningCount,Desired:desiredCount,Pending:pendingCount}' \
        --output table
}

# Tail logs
show_logs() {
    echo -e "${GREEN}Tailing logs (Ctrl+C to exit):${NC}"
    aws logs tail /ecs/file-management-service --follow
}

# Show outputs
show_outputs() {
    echo -e "${GREEN}Stack Outputs:${NC}"
    aws cloudformation describe-stacks \
        --stack-name $STACK_NAME \
        --query 'Stacks[0].Outputs[*].[OutputKey,OutputValue]' \
        --output table
}

# Scale service
scale_service() {
    if [ -z "$1" ]; then
        echo -e "${RED}Error: Please specify desired count${NC}"
        echo "Usage: $0 scale [count]"
        exit 1
    fi
    
    echo -e "${GREEN}Scaling service to $1 tasks...${NC}"
    aws ecs update-service \
        --cluster $CLUSTER_NAME \
        --service $SERVICE_NAME \
        --desired-count $1 \
        --output table
}

# Restart service
restart_service() {
    echo -e "${GREEN}Restarting service...${NC}"
    aws ecs update-service \
        --cluster $CLUSTER_NAME \
        --service $SERVICE_NAME \
        --force-new-deployment \
        --output table
}

# Check health
check_health() {
    SERVICE_URL=$(get_output "ServiceUrl")
    
    if [ -z "$SERVICE_URL" ]; then
        echo -e "${RED}Error: Could not get service URL${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}Service URL: $SERVICE_URL${NC}"
    echo -e "${GREEN}Checking health...${NC}"
    
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" $SERVICE_URL/health)
    
    if [ "$RESPONSE" = "200" ]; then
        echo -e "${GREEN}✅ Service is healthy (HTTP $RESPONSE)${NC}"
        curl -s $SERVICE_URL/health | jq .
    else
        echo -e "${RED}❌ Service is unhealthy (HTTP $RESPONSE)${NC}"
    fi
}

# List tasks
list_tasks() {
    echo -e "${GREEN}Running Tasks:${NC}"
    TASKS=$(aws ecs list-tasks --cluster $CLUSTER_NAME --service-name $SERVICE_NAME --query 'taskArns[*]' --output text)
    
    if [ -z "$TASKS" ]; then
        echo "No running tasks"
        return
    fi
    
    aws ecs describe-tasks \
        --cluster $CLUSTER_NAME \
        --tasks $TASKS \
        --query 'tasks[*].{TaskId:taskArn,Status:lastStatus,Health:healthStatus,Started:startedAt}' \
        --output table
}

# List images
list_images() {
    echo -e "${GREEN}ECR Images:${NC}"
    aws ecr describe-images \
        --repository-name $REPO_NAME \
        --query 'sort_by(imageDetails,&imagePushedAt)[*].{Pushed:imagePushedAt,Tags:join(`,`,imageTags[*]),Size:imageSizeInBytes}' \
        --output table
}

# Show cost estimate
show_cost() {
    echo -e "${GREEN}💰 Monthly Cost Estimate:${NC}"
    echo ""
    echo "Fixed Costs:"
    echo "  - Fargate (1 task, 0.25 vCPU, 0.5GB):  ~\$15/month"
    echo "  - Application Load Balancer:            ~\$16/month"
    echo "  - NAT Gateway (per AZ):                 ~\$32/month"
    echo ""
    echo "Variable Costs:"
    echo "  - S3 Storage:                           Pay per GB"
    echo "  - S3 Requests:                          Pay per request"
    echo "  - ECR Storage:                          \$0.10/GB/month"
    echo "  - CloudWatch Logs:                      Pay per GB"
    echo "  - Data Transfer:                        Pay per GB"
    echo ""
    echo "Estimated Total: \$75-100/month (minimal setup)"
    echo ""
}

# Cleanup unused resources
cleanup_resources() {
    echo -e "${YELLOW}⚠️  This will remove old ECR images and stopped tasks${NC}"
    read -p "Continue? (y/n) " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Cancelled"
        exit 0
    fi
    
    # Keep only last 5 images
    echo -e "${GREEN}Cleaning up old ECR images...${NC}"
    OLD_IMAGES=$(aws ecr list-images \
        --repository-name $REPO_NAME \
        --query 'sort_by(imageIds,&imageDigest)[:-5].[imageDigest]' \
        --output text)
    
    if [ ! -z "$OLD_IMAGES" ]; then
        for digest in $OLD_IMAGES; do
            aws ecr batch-delete-image \
                --repository-name $REPO_NAME \
                --image-ids imageDigest=$digest
        done
        echo "Deleted $(echo $OLD_IMAGES | wc -w) old images"
    else
        echo "No old images to delete"
    fi
    
    echo -e "${GREEN}✅ Cleanup complete${NC}"
}

# Main script
case "$1" in
    status)
        show_status
        ;;
    logs)
        show_logs
        ;;
    outputs)
        show_outputs
        ;;
    scale)
        scale_service "$2"
        ;;
    restart)
        restart_service
        ;;
    health)
        check_health
        ;;
    tasks)
        list_tasks
        ;;
    images)
        list_images
        ;;
    cost)
        show_cost
        ;;
    cleanup)
        cleanup_resources
        ;;
    *)
        show_usage
        exit 1
        ;;
esac
