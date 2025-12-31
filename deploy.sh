#!/bin/bash

# Influencerium Production Deployment Script
# Usage: ./deploy.sh [environment]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
ENV_FILE="$BACKEND_DIR/.env"

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_dependencies() {
    log_info "Checking dependencies..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        exit 1
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        log_error "npm is not installed"
        exit 1
    fi
    
    # Check PostgreSQL client
    if ! command -v psql &> /dev/null; then
        log_warn "PostgreSQL client not found - database migration may fail"
    fi
    
    log_info "All dependencies are available"
}

setup_environment() {
    log_info "Setting up environment..."
    
    # Check if .env file exists
    if [ ! -f "$ENV_FILE" ]; then
        if [ -f "$ENV_FILE.example" ]; then
            log_warn ".env file not found. Creating from example..."
            cp "$ENV_FILE.example" "$ENV_FILE"
            log_warn "Please edit $ENV_FILE with your production values!"
            exit 1
        else
            log_error ".env.example not found"
            exit 1
        fi
    fi
    
    log_info "Environment configured"
}

install_backend_dependencies() {
    log_info "Installing backend dependencies..."
    
    cd "$BACKEND_DIR"
    npm ci --only=production
    
    log_info "Backend dependencies installed"
}

install_frontend_dependencies() {
    log_info "Installing frontend dependencies..."
    
    cd "$FRONTEND_DIR"
    
    # No npm install needed for static frontend
    log_info "Frontend is static HTML - no dependencies needed"
}

run_database_migrations() {
    log_info "Running database migrations..."
    
    cd "$BACKEND_DIR"
    
    # Check if database is accessible
    if command -v psql &> /dev/null; then
        DB_HOST=$(grep "host:" config.production.yaml | awk '{print $2}')
        DB_USER=$(grep "username:" config.production.yaml | awk '{print $2}')
        
        if psql -h "$DB_HOST" -U "$DB_USER" -c "SELECT 1" &> /dev/null; then
            log_info "Database is accessible. Running migrations..."
            npm run migrate
            log_info "Database migrations completed"
        else
            log_warn "Database is not accessible. Please run migrations manually."
        fi
    else
        log_warn "PostgreSQL client not found. Please run migrations manually."
        log_info "Run: cd backend && npm run migrate"
    fi
}

build_frontend() {
    log_info "Preparing frontend for production..."
    
    cd "$FRONTEND_DIR"
    
    # Frontend is already built - just copy to production location
    log_info "Frontend is static - ready to serve"
}

start_services() {
    log_info "Starting services..."
    
    cd "$BACKEND_DIR"
    
    # Check if PM2 is installed
    if command -v pm2 &> /dev/null; then
        log_info "Starting backend with PM2..."
        pm2 delete influencerium-api 2>/dev/null || true
        pm2 start ecosystem.config.js --env production
        pm2 save
        pm2 startup 2>/dev/null || log_warn "Could not setup PM2 startup script"
        log_info "Backend started with PM2"
    else
        log_warn "PM2 not found. Starting backend directly..."
        nohup node src/index.js > /var/log/influencerium/backend.log 2>&1 &
        log_info "Backend started in background"
    fi
    
    log_info "All services started"
}

verify_deployment() {
    log_info "Verifying deployment..."
    
    # Check if backend is running
    BACKEND_URL="http://localhost:3000"
    
    if command -v curl &> /dev/null; then
        if curl -s -f "$BACKEND_URL/health" > /dev/null; then
            log_info "Backend is running and healthy"
            
            # Check API response
            RESPONSE=$(curl -s "$BACKEND_URL/api-docs")
            if echo "$RESPONSE" | grep -q "Influencerium"; then
                log_info "API documentation is accessible"
            fi
        else
            log_error "Backend health check failed"
            exit 1
        fi
    else
        log_warn "curl not found - skipping health check"
    fi
    
    log_info "Deployment verified successfully"
}

display_summary() {
    echo ""
    echo "========================================"
    echo -e "${GREEN}Deployment Complete!${NC}"
    echo "========================================"
    echo ""
    echo "Backend API: http://localhost:3000"
    echo "API Docs: http://localhost:3000/docs"
    echo "Health Check: http://localhost:3000/health"
    echo ""
    echo "Useful commands:"
    echo "  View logs: pm2 logs influencerium-api"
    echo "  Restart: pm2 restart influencerium-api"
    echo "  Stop: pm2 stop influencerium-api"
    echo "  Status: pm2 status influencerium-api"
    echo ""
    echo "========================================"
}

# Main execution
main() {
    echo ""
    echo "========================================"
    echo "  Influencerium Deployment Script"
    echo "========================================"
    echo ""
    
    check_dependencies
    setup_environment
    install_backend_dependencies
    install_frontend_dependencies
    build_frontend
    run_database_migrations
    start_services
    verify_deployment
    display_summary
}

# Run main function
main "$@"
