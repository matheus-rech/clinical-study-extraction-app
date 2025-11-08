#!/bin/bash

# Clinical Study Extraction App - Deployment Script
# This script sets up and deploys the application

set -e  # Exit on error

echo "================================================"
echo "Clinical Study Extraction App - Deployment"
echo "================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo -e "${GREEN}✓${NC} Working directory: $SCRIPT_DIR"
echo ""

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
   echo -e "${RED}✗${NC} Please do not run this script as root"
   exit 1
fi

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo "Checking prerequisites..."
echo ""

if ! command_exists python3; then
    echo -e "${RED}✗${NC} Python 3 is not installed"
    exit 1
fi
echo -e "${GREEN}✓${NC} Python 3 is installed"

if ! command_exists pip3; then
    echo -e "${RED}✗${NC} pip3 is not installed"
    exit 1
fi
echo -e "${GREEN}✓${NC} pip3 is installed"

if ! command_exists tesseract; then
    echo -e "${YELLOW}!${NC} Tesseract OCR is not installed. Installing..."
    sudo apt-get update -qq
    sudo apt-get install -y tesseract-ocr tesseract-ocr-eng
    echo -e "${GREEN}✓${NC} Tesseract OCR installed"
else
    echo -e "${GREEN}✓${NC} Tesseract OCR is installed"
fi

echo ""

# Install backend dependencies
echo "Installing backend dependencies..."
cd "$SCRIPT_DIR/backend"

if [ ! -f "requirements.txt" ]; then
    echo -e "${RED}✗${NC} requirements.txt not found"
    exit 1
fi

sudo pip3 install -r requirements.txt > /dev/null 2>&1
echo -e "${GREEN}✓${NC} Backend dependencies installed"
echo ""

# Check if .env exists
if [ ! -f "$SCRIPT_DIR/backend/.env" ]; then
    echo -e "${YELLOW}!${NC} Backend .env file not found. Creating from template..."
    
    # Prompt for Gemini API key
    read -p "Enter your Gemini API key (or press Enter to skip): " GEMINI_KEY
    
    cat > "$SCRIPT_DIR/backend/.env" << EOF
# Application
APP_NAME="Clinical Study PDF Processor"
APP_VERSION="2.0.0"
ENVIRONMENT="development"
DEBUG=true

# Server
HOST="0.0.0.0"
PORT=8000

# CORS
CORS_ORIGINS=["*"]

# API Keys
GEMINI_API_KEY="${GEMINI_KEY:-YOUR_GEMINI_API_KEY_HERE}"

# File Upload
MAX_UPLOAD_SIZE=52428800
ALLOWED_EXTENSIONS=[".pdf"]

# Processing
MAX_WORKERS=4
TIMEOUT_SECONDS=300
EOF
    
    echo -e "${GREEN}✓${NC} Backend .env file created"
    
    if [ -z "$GEMINI_KEY" ]; then
        echo -e "${YELLOW}!${NC} Please edit backend/.env and add your Gemini API key"
    fi
else
    echo -e "${GREEN}✓${NC} Backend .env file exists"
fi

echo ""

# Check if frontend .env exists
if [ ! -f "$SCRIPT_DIR/frontend/.env" ]; then
    echo -e "${YELLOW}!${NC} Frontend .env file not found. Creating from template..."
    
    cat > "$SCRIPT_DIR/frontend/.env" << EOF
VITE_API_URL=http://localhost:8000
VITE_GEMINI_API_KEY=${GEMINI_KEY:-YOUR_GEMINI_API_KEY_HERE}
EOF
    
    echo -e "${GREEN}✓${NC} Frontend .env file created"
else
    echo -e "${GREEN}✓${NC} Frontend .env file exists"
fi

echo ""

# Kill existing processes
echo "Stopping existing services..."
pkill -f "uvicorn.*app.main:app" || true
pkill -f "http.server 3000" || true
sleep 2
echo -e "${GREEN}✓${NC} Existing services stopped"
echo ""

# Start backend
echo "Starting backend server..."
cd "$SCRIPT_DIR/backend"
nohup python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
echo -e "${GREEN}✓${NC} Backend started (PID: $BACKEND_PID)"
echo "   Log: /tmp/backend.log"
echo "   URL: http://localhost:8000"
echo ""

# Wait for backend to start
echo "Waiting for backend to be ready..."
for i in {1..30}; do
    if curl -s http://localhost:8000/ > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Backend is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}✗${NC} Backend failed to start. Check /tmp/backend.log"
        exit 1
    fi
    sleep 1
done
echo ""

# Start frontend
echo "Starting frontend server..."
cd "$SCRIPT_DIR/frontend/public"
nohup python3 -m http.server 3000 > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!
echo -e "${GREEN}✓${NC} Frontend started (PID: $FRONTEND_PID)"
echo "   Log: /tmp/frontend.log"
echo "   URL: http://localhost:3000"
echo ""

# Wait for frontend to start
echo "Waiting for frontend to be ready..."
for i in {1..10}; do
    if curl -s http://localhost:3000/ > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Frontend is ready"
        break
    fi
    if [ $i -eq 10 ]; then
        echo -e "${RED}✗${NC} Frontend failed to start. Check /tmp/frontend.log"
        exit 1
    fi
    sleep 1
done
echo ""

# Summary
echo "================================================"
echo -e "${GREEN}✓ Deployment Complete!${NC}"
echo "================================================"
echo ""
echo "Services:"
echo "  • Backend API:  http://localhost:8000"
echo "  • API Docs:     http://localhost:8000/docs"
echo "  • Frontend:     http://localhost:3000"
echo ""
echo "Logs:"
echo "  • Backend:      /tmp/backend.log"
echo "  • Frontend:     /tmp/frontend.log"
echo ""
echo "Process IDs:"
echo "  • Backend PID:  $BACKEND_PID"
echo "  • Frontend PID: $FRONTEND_PID"
echo ""
echo "To stop services:"
echo "  pkill -f 'uvicorn.*app.main:app'"
echo "  pkill -f 'http.server 3000'"
echo ""
echo "To view logs:"
echo "  tail -f /tmp/backend.log"
echo "  tail -f /tmp/frontend.log"
echo ""
echo "================================================"
