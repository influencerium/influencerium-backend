#!/bin/bash

# Azure Deployment Script for Influencerium
# Usage: ./deploy-azure.sh [environment]

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ENVIRONMENT=${1:-production}
RESOURCE_GROUP="influencerium-${ENVIRONMENT}"
LOCATION="eastus"
TEMPLATE_FILE="arm/azure-deploy.json"

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check Azure CLI
check_azure_cli() {
    log_info "Checking Azure CLI..."
    if ! command -v az &> /dev/null; then
        log_error "Azure CLI not installed. Please install it first."
        exit 1
    fi
    
    # Check login
    if ! az account show &> /dev/null; then
        log_error "Not logged in to Azure. Run 'az login' first."
        exit 1
    fi
    
    SUBSCRIPTION_ID=$(az account show --query 'id' --output tsv)
    log_info "Azure CLI configured. Subscription: $SUBSCRIPTION_ID"
}

# Generate secure passwords
generate_passwords() {
    log_info "Generating secure passwords..."
    
    DB_PASSWORD=$(openssl rand -base64 32)
    JWT_SECRET=$(openssl rand -base64 64)
    
    log_info "Passwords generated (save these securely):"
    echo "DB_PASSWORD=$DB_PASSWORD"
    echo "JWT_SECRET=$JWT_SECRET"
}

# Create resource group
create_resource_group() {
    log_info "Creating resource group: $RESOURCE_GROUP"
    
    if az group show --name "$RESOURCE_GROUP" &> /dev/null; then
        log_info "Resource group already exists"
    else
        az group create \
            --name "$RESOURCE_GROUP" \
            --location "$LOCATION" \
            --tags "Environment=$ENVIRONMENT" "Project=Influencerium"
        
        log_info "Resource group created"
    fi
}

# Deploy template
deploy_template() {
    log_info "Deploying Azure resources..."
    
    # Generate passwords if not set
    if [ -z "$DB_PASSWORD" ]; then
        generate_passwords
    fi
    
    az deployment group create \
        --resource-group "$RESOURCE_GROUP" \
        --name "influencerium-deploy" \
        --template-file "$TEMPLATE_FILE" \
        --parameters \
            "environment=$ENVIRONMENT" \
            "appName=influencerium" \
            "location=$LOCATION" \
            "dbPassword=$DB_PASSWORD" \
            "jwtSecret=$JWT_SECRET" \
        --output table
    
    log_info "Deployment completed"
}

# Get deployment outputs
get_outputs() {
    log_info "Getting deployment outputs..."
    
    WEB_APP_URL=$(az deployment group show \
        --resource-group "$RESOURCE_GROUP" \
        --name "influencerium-deploy" \
        --query "properties.outputs.webAppUrl.value" \
        --output tsv)
    
    DB_SERVER=$(az deployment group show \
        --resource-group "$RESOURCE_GROUP" \
        --name "influencerium-deploy" \
        --query "properties.outputs.databaseServer.value" \
        --output tsv)
    
    CDN_ENDPOINT=$(az deployment group show \
        --resource-group "$RESOURCE_GROUP" \
        --name "influencerium-deploy" \
        --query "properties.outputs.cdnEndpoint.value" \
        --output tsv)
    
    echo ""
    echo "========================================"
    echo -e "${GREEN}Azure Deployment Successful!${NC}"
    echo "========================================"
    echo ""
    echo "Web App URL:"
    echo -e "${GREEN}$WEB_APP_URL${NC}"
    echo ""
    echo "Database Server:"
    echo -e "${GREEN}$DB_SERVER${NC}"
    echo ""
    echo "CDN Endpoint:"
    echo -e "${GREEN}$CDN_ENDPOINT${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Configure custom domain in Azure App Service"
    echo "2. Upload Docker image to Azure Container Registry"
    echo "3. Deploy frontend to Azure Static Web Apps"
    echo "========================================"
}

# Build and push Docker image to ACR
build_and_push_image() {
    log_info "Building and pushing Docker image to Azure Container Registry..."
    
    # Create ACR if not exists
    ACR_NAME="influencerium${ENVIRONMENT}acr"
    
    if ! az acr show --name "$ACR_NAME" &> /dev/null; then
        az acr create \
            --resource-group "$RESOURCE_GROUP" \
            --name "$ACR_NAME" \
            --sku Basic \
            --admin-enabled true
        
        log_info "Container Registry created: $ACR_NAME.azurecr.io"
    fi
    
    # Login to ACR
    az acr login --name "$ACR_NAME"
    
    # Build image
    docker build -t influencerium-backend:latest ./backend
    
    # Tag and push
    az acr build \
        --registry "$ACR_NAME" \
        --image influencerium-backend:latest \
        ./backend
    
    log_info "Docker image pushed to ACR"
}

# Deploy frontend to Azure Static Web Apps
deploy_frontend() {
    log_info "Deploying frontend to Azure Static Web Apps..."
    
    STATIC_APP_NAME="influencerium-${ENVIRONMENT}-frontend"
    
    az staticwebapp create \
        --name "$STATIC_APP_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --location "$LOCATION" \
        --sku Free \
        --output table
    
    # Deploy using GitHub Actions or Azure CLI
    log_info "Frontend Static Web App created: $STATIC_APP_NAME.azurestaticapps.net"
}

# Configure custom domain
configure_domain() {
    log_info "Configuring custom domain..."
    
    DOMAIN_NAME="$2"
    
    if [ -z "$DOMAIN_NAME" ]; then
        log_warn "Domain name not provided. Skipping custom domain configuration."
        return
    fi
    
    # Verify domain ownership
    az webapp config custom-domain create \
        --resource-group "$RESOURCE_GROUP" \
        --name "$WEB_APP_NAME" \
        --domain-name "$DOMAIN_NAME"
    
    log_info "Custom domain $DOMAIN_NAME configured"
}

# Monitor deployment
monitor_deployment() {
    log_info "Monitoring deployment..."
    
    # Check web app status
    WEB_APP_STATUS=$(az webapp show \
        --resource-group "$RESOURCE_GROUP" \
        --name "$WEB_APP_NAME" \
        --query "state" \
        --output tsv)
    
    if [ "$WEB_APP_STATUS" == "Running" ]; then
        log_info "Web App is running"
    else
        log_warn "Web App status: $WEB_APP_STATUS"
    fi
    
    # Check database status
    DB_STATUS=$(az sql server show \
        --resource-group "$RESOURCE_GROUP" \
        --name "$SQL_SERVER_NAME" \
        --query "state" \
        --output tsv)
    
    log_info "Database status: $DB_STATUS"
}

# Show help
show_help() {
    echo "Influencerium Azure Deployment Script"
    echo ""
    echo "Usage: $0 [environment]"
    echo ""
    echo "Arguments:"
    echo "  environment  Deployment environment (default: production)"
    echo ""
    echo "Examples:"
    echo "  $0 production"
    echo "  $0 staging"
    echo "  $0 development"
    echo ""
    echo "Environment Variables:"
    echo "  DB_PASSWORD     Database password (auto-generated if not set)"
    echo "  JWT_SECRET      JWT secret (auto-generated if not set)"
    echo ""
    echo "This script will:"
    echo "1. Check Azure CLI configuration"
    echo "2. Create resource group"
    echo "3. Deploy Azure resources (App Service, SQL Database, Key Vault)"
    echo "4. Configure secrets in Key Vault"
    echo "5. Set up CDN"
    echo "6. Configure monitoring"
    echo ""
}

# Main execution
main() {
    echo ""
    echo "========================================"
    echo "  Influencerium Azure Deployment"
    echo "========================================"
    echo ""
    
    case "$1" in
        -h|--help)
            show_help
            exit 0
            ;;
    esac
    
    check_azure_cli
    create_resource_group
    deploy_template
    monitor_deployment
    get_outputs
    
    log_info "Deployment complete!"
}

main "$@"
