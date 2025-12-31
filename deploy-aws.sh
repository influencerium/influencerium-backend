#!/bin/bash

# AWS Deployment Script for Influencerium
# Usage: ./deploy-aws.sh [environment] [region]

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ENVIRONMENT=${1:-production}
REGION=${2:-us-east-1}
STACK_NAME="influencerium-${ENVIRONMENT}"
CFN_TEMPLATE="cloudformation/aws-influencerium.yaml"
AWS_ACCOUNT=$(aws sts get-caller-identity --query 'Account' --output text)

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Pre-deployment checks
check_aws_cli() {
    log_info "Checking AWS CLI..."
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI not installed. Please install it first."
        exit 1
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS credentials not configured. Run 'aws configure' first."
        exit 1
    fi
    
    log_info "AWS CLI configured. Account: $AWS_ACCOUNT"
}

check_cfn_template() {
    log_info "Checking CloudFormation template..."
    if [ ! -f "$CFN_TEMPLATE" ]; then
        log_error "CloudFormation template not found: $CFN_TEMPLATE"
        exit 1
    fi
    log_info "CloudFormation template found"
}

# Validate CloudFormation template
validate_template() {
    log_info "Validating CloudFormation template..."
    aws cloudformation validate-template \
        --template-body "file://$CFN_TEMPLATE" \
        --region "$REGION" || {
        log_error "Template validation failed"
        exit 1
    }
    log_info "Template validated successfully"
}

# Create database password secret
create_secrets() {
    log_info "Creating database password secret..."
    
    SECRET_NAME="${STACK_NAME}-db-password"
    
    if ! aws secretsmanager describe-secret \
        --secret-id "$SECRET_NAME" \
        --region "$REGION" &> /dev/null; then
        
        aws secretsmanager create-secret \
            --name "$SECRET_NAME" \
            --secret-string "$(openssl rand -base64 32)" \
            --region "$REGION"
        
        log_info "Database password secret created"
    else
        log_warn "Database password secret already exists"
    fi
}

# Deploy CloudFormation stack
deploy_stack() {
    log_info "Deploying CloudFormation stack: $STACK_NAME in $REGION"
    
    # Check if stack exists
    if aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --region "$REGION" &> /dev/null; then
        
        log_info "Stack exists. Updating..."
        
        aws cloudformation update-stack \
            --stack-name "$STACK_NAME" \
            --template-body "file://$CFN_TEMPLATE" \
            --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
            --region "$REGION" \
            --parameters \
                "ParameterKey=Environment,ParameterValue=$ENVIRONMENT" \
                "ParameterKey=AppName,ParameterValue=influencerium" \
                "ParameterKey=DesiredCount,ParameterValue=2" \
                "ParameterKey=MaxCount,ParameterValue=10" \
                "ParameterKey=MinCount,ParameterValue=1" \
                "ParameterKey=DatabaseInstanceType,ParameterValue=db.t3.micro" \
            || log_warn "No changes to stack or update in progress"
        
        log_info "Waiting for stack update to complete..."
        aws cloudformation wait stack-update-complete \
            --stack-name "$STACK_NAME" \
            --region "$REGION"
            
    else
        log_info "Creating new stack..."
        
        aws cloudformation create-stack \
            --stack-name "$STACK_NAME" \
            --template-body "file://$CFN_TEMPLATE" \
            --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
            --region "$REGION" \
            --parameters \
                "ParameterKey=Environment,ParameterValue=$ENVIRONMENT" \
                "ParameterKey=AppName,ParameterValue=influencerium" \
                "ParameterKey=DesiredCount,ParameterValue=2" \
                "ParameterKey=MaxCount,ParameterValue=10" \
                "ParameterKey=MinCount,ParameterValue=1" \
                "ParameterKey=DatabaseInstanceType,ParameterValue=db.t3.micro"
        
        log_info "Waiting for stack creation to complete..."
        aws cloudformation wait stack-create-complete \
            --stack-name "$STACK_NAME" \
            --region "$REGION"
    fi
    
    log_info "Stack deployment completed"
}

# Get stack outputs
get_outputs() {
    log_info "Getting stack outputs..."
    
    STACK_INFO=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --region "$REGION" \
        --query 'Stacks[0].Outputs')
    
    ALB_DNS=$(echo "$STACK_INFO" | jq -r '.[] | select(.OutputKey=="ALBDNSName") | .OutputValue')
    DB_ENDPOINT=$(echo "$STACK_INFO" | jq -r '.[] | select(.OutputKey=="DatabaseEndpoint") | .OutputValue')
    
    echo ""
    echo "========================================"
    echo -e "${GREEN}Deployment Successful!${NC}"
    echo "========================================"
    echo ""
    echo "Application Load Balancer DNS:"
    echo -e "${GREEN}$ALB_DNS${NC}"
    echo ""
    echo "Database Endpoint:"
    echo -e "${GREEN}$DB_ENDPOINT${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Configure your domain DNS to point to $ALB_DNS"
    echo "2. Upload Docker image to ECR"
    echo "3. Deploy frontend to S3/CloudFront or Vercel"
    echo "========================================"
}

# Build and push Docker image
build_and_push_image() {
    log_info "Building and pushing Docker image..."
    
    # Get ECR repository URI
    ECR_REPO="$AWS_ACCOUNT.dkr.ecr.$REGION.amazonaws.com/influencerium-backend"
    
    # Login to ECR
    aws ecr get-login-password --region "$REGION" | \
        docker login --username AWS --password-stdin "$AWS_ACCOUNT.dkr.ecr.$REGION.amazonaws.com"
    
    # Build Docker image
    docker build -t influencerium-backend:latest ./backend
    
    # Tag image
    docker tag influencerium-backend:latest "$ECR_REPO:latest"
    
    # Push image
    docker push "$ECR_REPO:latest"
    
    log_info "Docker image pushed to ECR: $ECR_REPO"
}

# Monitor deployment
monitor_deployment() {
    log_info "Monitoring deployment..."
    
    EVENTS=$(aws cloudformation describe-stack-events \
        --stack-name "$STACK_NAME" \
        --region "$REGION" \
        --query 'StackEvents[?ResourceStatus==`CREATE_FAILED` || ResourceStatus==`UPDATE_FAILED`]' \
        --output json)
    
    if [ "$EVENTS" != "[]" ]; then
        log_error "Some resources failed to create/update:"
        echo "$EVENTS" | jq '.'
        exit 1
    fi
    
    log_info "All resources are healthy"
}

# Show help
show_help() {
    echo "Influencerium AWS Deployment Script"
    echo ""
    echo "Usage: $0 [environment] [region]"
    echo ""
    echo "Arguments:"
    echo "  environment  Deployment environment (default: production)"
    echo "  region       AWS region (default: us-east-1)"
    echo ""
    echo "Examples:"
    echo "  $0 production us-east-1"
    echo "  $0 staging eu-west-1"
    echo "  $0 development us-west-2"
    echo ""
    echo "This script will:"
    echo "1. Check AWS CLI configuration"
    echo "2. Validate CloudFormation template"
    echo "3. Create/update CloudFormation stack"
    echo "4. Deploy ECS Fargate service"
    echo "5. Configure Application Load Balancer"
    echo "6. Set up auto-scaling"
    echo ""
}

# Main execution
main() {
    echo ""
    echo "========================================"
    echo "  Influencerium AWS Deployment"
    echo "========================================"
    echo ""
    
    case "$1" in
        -h|--help)
            show_help
            exit 0
            ;;
    esac
    
    check_aws_cli
    check_cfn_template
    validate_template
    create_secrets
    deploy_stack
    monitor_deployment
    get_outputs
    
    log_info "Deployment complete!"
}

main "$@"
