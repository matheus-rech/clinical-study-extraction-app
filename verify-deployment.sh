#!/bin/bash
# Deployment Verification Script
# Checks if both backend and frontend are running correctly

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BACKEND_URL="${BACKEND_URL:-http://localhost:8000}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:3000}"
TIMEOUT=5

echo "======================================"
echo "  Deployment Verification Script"
echo "======================================"
echo ""

# Function to check HTTP endpoint
check_endpoint() {
    local url=$1
    local name=$2

    echo -n "Checking $name... "

    if curl -s -f -m "$TIMEOUT" "$url" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ OK${NC}"
        return 0
    else
        echo -e "${RED}✗ FAILED${NC}"
        return 1
    fi
}

# Function to check JSON endpoint
check_json_endpoint() {
    local url=$1
    local name=$2
    local expected_key=$3

    echo -n "Checking $name... "

    response=$(curl -s -f -m "$TIMEOUT" "$url" 2>/dev/null)

    if [ $? -eq 0 ] && echo "$response" | grep -q "\"$expected_key\""; then
        echo -e "${GREEN}✓ OK${NC}"
        echo "  Response: $(echo "$response" | head -c 100)..."
        return 0
    else
        echo -e "${RED}✗ FAILED${NC}"
        return 1
    fi
}

# Track failures
failures=0

echo "Backend Checks:"
echo "---------------"

# Check backend health
if ! check_json_endpoint "$BACKEND_URL/health" "Health endpoint" "status"; then
    ((failures++))
fi

# Check backend root
if ! check_json_endpoint "$BACKEND_URL/" "Root endpoint" "service"; then
    ((failures++))
fi

# Check API docs
if ! check_endpoint "$BACKEND_URL/docs" "API documentation"; then
    ((failures++))
fi

echo ""
echo "Frontend Checks:"
echo "----------------"

# Check frontend
if ! check_endpoint "$FRONTEND_URL" "Frontend"; then
    ((failures++))
fi

echo ""
echo "======================================"

if [ $failures -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed!${NC}"
    echo ""
    echo "Your application is running correctly:"
    echo "  - Backend: $BACKEND_URL"
    echo "  - Frontend: $FRONTEND_URL"
    echo "  - API Docs: $BACKEND_URL/docs"
    exit 0
else
    echo -e "${RED}✗ $failures check(s) failed!${NC}"
    echo ""
    echo "Troubleshooting tips:"
    echo "  1. Check if containers are running: docker-compose ps"
    echo "  2. Check logs: docker-compose logs"
    echo "  3. Verify environment variables are set correctly"
    echo "  4. Check if ports are already in use"
    exit 1
fi
