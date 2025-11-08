#!/bin/bash
# Local Production Deployment Script
# Quickly deploy the application locally for testing

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}======================================"
echo "  Local Production Deployment"
echo "======================================${NC}"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Error: Docker is not running${NC}"
    echo "Please start Docker and try again"
    exit 1
fi

# Check if .env.production exists
if [ ! -f .env.production ]; then
    echo -e "${YELLOW}Creating .env.production from template...${NC}"
    cp .env.production.example .env.production

    echo -e "${YELLOW}⚠️  Please edit .env.production with your values${NC}"
    echo "Press Enter to open the file in your default editor..."
    read
    ${EDITOR:-nano} .env.production
fi

echo -e "${BLUE}Loading environment variables...${NC}"
set -a
source .env.production
set +a

echo -e "${BLUE}Building production images...${NC}"
docker-compose -f docker-compose.prod.yml build

echo -e "${BLUE}Starting services...${NC}"
docker-compose -f docker-compose.prod.yml up -d

echo ""
echo -e "${BLUE}Waiting for services to be ready...${NC}"
sleep 10

echo ""
echo -e "${BLUE}Running verification checks...${NC}"
./verify-deployment.sh

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}======================================"
    echo "  🎉 Deployment Successful!"
    echo "======================================${NC}"
    echo ""
    echo "Your application is running at:"
    echo -e "  ${GREEN}Frontend:${NC} http://localhost:${FRONTEND_PORT:-3000}"
    echo -e "  ${GREEN}Backend:${NC}  http://localhost:${BACKEND_PORT:-8000}"
    echo -e "  ${GREEN}API Docs:${NC} http://localhost:${BACKEND_PORT:-8000}/docs"
    echo ""
    echo "Useful commands:"
    echo "  View logs:    docker-compose -f docker-compose.prod.yml logs -f"
    echo "  Stop:         docker-compose -f docker-compose.prod.yml down"
    echo "  Restart:      docker-compose -f docker-compose.prod.yml restart"
    echo ""
else
    echo ""
    echo -e "${RED}======================================"
    echo "  ⚠️  Deployment verification failed"
    echo "======================================${NC}"
    echo ""
    echo "Check the logs for errors:"
    echo "  docker-compose -f docker-compose.prod.yml logs"
    echo ""
    exit 1
fi
