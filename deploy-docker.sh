#!/bin/bash

# Clinical Study Extraction App - Docker Compose Deployment Script
# This script handles deployment with Docker Compose

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

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

# Check if .env file exists
if [ ! -f .env ]; then
    log_error ".env file not found!"
    log_info "Please copy .env.example to .env and configure it"
    log_info "  cp .env.example .env"
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    log_error "Docker is not installed!"
    log_info "Please install Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    log_error "Docker Compose is not installed!"
    log_info "Please install Docker Compose: https://docs.docker.com/compose/install/"
    exit 1
fi

# Determine Docker Compose command
if docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
else
    DOCKER_COMPOSE="docker-compose"
fi

log_info "Using Docker Compose command: $DOCKER_COMPOSE"

# Parse command line arguments
COMMAND=${1:-up}

case $COMMAND in
    up|start)
        log_info "Starting services..."
        $DOCKER_COMPOSE up -d --build
        log_info "Waiting for services to be healthy..."
        sleep 10
        $DOCKER_COMPOSE ps
        log_info "Checking backend health..."
        curl -f http://localhost:8000/health || log_warn "Backend health check failed"
        log_info "✅ Deployment complete!"
        log_info "Backend API: http://localhost:8000"
        log_info "Frontend: http://localhost:3000"
        log_info "API Docs: http://localhost:8000/docs"
        ;;
    
    down|stop)
        log_info "Stopping services..."
        $DOCKER_COMPOSE down
        log_info "✅ Services stopped"
        ;;
    
    restart)
        log_info "Restarting services..."
        $DOCKER_COMPOSE down
        $DOCKER_COMPOSE up -d --build
        sleep 10
        $DOCKER_COMPOSE ps
        log_info "✅ Services restarted"
        ;;
    
    logs)
        SERVICE=${2:-}
        if [ -z "$SERVICE" ]; then
            $DOCKER_COMPOSE logs -f
        else
            $DOCKER_COMPOSE logs -f $SERVICE
        fi
        ;;
    
    ps|status)
        log_info "Service status:"
        $DOCKER_COMPOSE ps
        ;;
    
    clean)
        log_warn "This will remove all containers, volumes, and images!"
        read -p "Are you sure? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            log_info "Cleaning up..."
            $DOCKER_COMPOSE down -v --rmi all
            log_info "✅ Cleanup complete"
        else
            log_info "Cleanup cancelled"
        fi
        ;;
    
    backup)
        log_info "Backing up database..."
        BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"
        docker exec clinical-study-db pg_dump -U postgres clinical_study > $BACKUP_FILE
        log_info "✅ Database backed up to: $BACKUP_FILE"
        ;;
    
    restore)
        BACKUP_FILE=${2:-}
        if [ -z "$BACKUP_FILE" ]; then
            log_error "Please specify backup file"
            log_info "Usage: ./deploy-docker.sh restore <backup_file>"
            exit 1
        fi
        if [ ! -f "$BACKUP_FILE" ]; then
            log_error "Backup file not found: $BACKUP_FILE"
            exit 1
        fi
        log_warn "This will restore database from: $BACKUP_FILE"
        read -p "Are you sure? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            log_info "Restoring database..."
            cat $BACKUP_FILE | docker exec -i clinical-study-db psql -U postgres clinical_study
            log_info "✅ Database restored"
        else
            log_info "Restore cancelled"
        fi
        ;;
    
    update)
        log_info "Updating application..."
        git pull origin main
        $DOCKER_COMPOSE pull
        $DOCKER_COMPOSE up -d --build
        sleep 10
        $DOCKER_COMPOSE ps
        log_info "✅ Update complete"
        ;;
    
    health)
        log_info "Checking service health..."
        echo "Backend:"
        curl -s http://localhost:8000/health | jq '.' || log_error "Backend not responding"
        echo ""
        echo "Database:"
        docker exec clinical-study-db pg_isready -U postgres || log_error "Database not ready"
        echo "Redis:"
        docker exec clinical-study-redis redis-cli ping || log_error "Redis not responding"
        ;;
    
    *)
        log_info "Clinical Study Extraction App - Docker Deployment Script"
        echo ""
        echo "Usage: ./deploy-docker.sh [command]"
        echo ""
        echo "Commands:"
        echo "  up, start       Start all services"
        echo "  down, stop      Stop all services"
        echo "  restart         Restart all services"
        echo "  logs [service]  View logs (optionally for specific service)"
        echo "  ps, status      Show service status"
        echo "  clean           Remove all containers, volumes, and images"
        echo "  backup          Backup database"
        echo "  restore <file>  Restore database from backup"
        echo "  update          Pull latest code and update services"
        echo "  health          Check service health"
        echo ""
        echo "Examples:"
        echo "  ./deploy-docker.sh up"
        echo "  ./deploy-docker.sh logs backend"
        echo "  ./deploy-docker.sh backup"
        echo "  ./deploy-docker.sh restore backup_20250108.sql"
        ;;
esac
