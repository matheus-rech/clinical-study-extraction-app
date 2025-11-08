#!/bin/bash

################################################################################
# Clinical Study Extraction App - One-Click Setup Script
# 
# This script will:
# 1. Install all dependencies (Docker, Docker Compose, Git)
# 2. Clone the repository
# 3. Configure environment variables
# 4. Deploy the application
# 5. Set up automatic updates
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/matheus-rech/clinical-study-extraction-app/main/setup.sh | bash
#
# Or:
#   wget -qO- https://raw.githubusercontent.com/matheus-rech/clinical-study-extraction-app/main/setup.sh | bash
#
################################################################################

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
REPO_URL="https://github.com/matheus-rech/clinical-study-extraction-app.git"
INSTALL_DIR="/opt/clinical-study-extraction-app"
BRANCH="main"

# Functions
print_banner() {
    echo -e "${CYAN}"
    cat << "EOF"
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   Clinical Study Extraction App - One-Click Setup            ║
║                                                               ║
║   This will install and configure everything automatically   ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}"
}

log_info() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[!]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
}

log_step() {
    echo -e "\n${BLUE}==>${NC} ${PURPLE}$1${NC}\n"
}

check_root() {
    if [ "$EUID" -eq 0 ]; then
        log_error "Please do not run this script as root"
        log_info "Run as regular user: curl -fsSL <url> | bash"
        exit 1
    fi
}

check_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
        VER=$VERSION_ID
    else
        log_error "Cannot detect OS"
        exit 1
    fi
    
    if [ "$OS" != "ubuntu" ] && [ "$OS" != "debian" ]; then
        log_warn "This script is designed for Ubuntu/Debian"
        log_warn "Detected OS: $OS $VER"
        read -p "Continue anyway? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
    
    log_info "OS: $OS $VER"
}

install_docker() {
    log_step "Installing Docker"
    
    if command -v docker &> /dev/null; then
        log_info "Docker already installed: $(docker --version)"
        return 0
    fi
    
    log_info "Installing Docker..."
    curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
    sudo sh /tmp/get-docker.sh
    rm /tmp/get-docker.sh
    
    log_info "Adding user to docker group..."
    sudo usermod -aG docker $USER
    
    log_info "Docker installed successfully"
}

install_docker_compose() {
    log_step "Checking Docker Compose"
    
    if docker compose version &> /dev/null; then
        log_info "Docker Compose already installed"
        return 0
    fi
    
    if command -v docker-compose &> /dev/null; then
        log_info "Docker Compose (standalone) already installed"
        return 0
    fi
    
    log_info "Docker Compose will be used via 'docker compose'"
}

install_dependencies() {
    log_step "Installing system dependencies"
    
    log_info "Updating package list..."
    sudo apt-get update -qq
    
    log_info "Installing required packages..."
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
        git \
        curl \
        wget \
        jq \
        ufw \
        fail2ban \
        unattended-upgrades \
        > /dev/null
    
    log_info "Dependencies installed"
}

setup_firewall() {
    log_step "Configuring firewall"
    
    log_info "Setting up UFW firewall..."
    sudo ufw --force enable > /dev/null 2>&1 || true
    sudo ufw default deny incoming > /dev/null 2>&1 || true
    sudo ufw default allow outgoing > /dev/null 2>&1 || true
    sudo ufw allow 22/tcp > /dev/null 2>&1 || true  # SSH
    sudo ufw allow 80/tcp > /dev/null 2>&1 || true  # HTTP
    sudo ufw allow 443/tcp > /dev/null 2>&1 || true # HTTPS
    sudo ufw allow 8000/tcp > /dev/null 2>&1 || true # Backend
    sudo ufw allow 3000/tcp > /dev/null 2>&1 || true # Frontend
    
    log_info "Firewall configured"
}

clone_repository() {
    log_step "Cloning repository"
    
    if [ -d "$INSTALL_DIR" ]; then
        log_warn "Directory $INSTALL_DIR already exists"
        read -p "Remove and re-clone? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            sudo rm -rf "$INSTALL_DIR"
        else
            log_info "Using existing directory"
            cd "$INSTALL_DIR"
            sudo git pull origin $BRANCH
            return 0
        fi
    fi
    
    log_info "Cloning from $REPO_URL..."
    sudo mkdir -p "$INSTALL_DIR"
    sudo git clone -b $BRANCH "$REPO_URL" "$INSTALL_DIR"
    sudo chown -R $USER:$USER "$INSTALL_DIR"
    
    log_info "Repository cloned to $INSTALL_DIR"
}

configure_environment() {
    log_step "Configuring environment"
    
    cd "$INSTALL_DIR"
    
    if [ -f .env ]; then
        log_warn ".env file already exists"
        read -p "Reconfigure? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Using existing .env file"
            return 0
        fi
    fi
    
    echo -e "${CYAN}"
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║                  Environment Configuration                    ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    # olmOCR API Key (Required)
    echo -e "${YELLOW}Required: olmOCR API Key${NC}"
    echo "Get your key from: https://deepinfra.com"
    read -p "Enter olmOCR API Key: " OLMOCR_KEY
    while [ -z "$OLMOCR_KEY" ]; do
        echo -e "${RED}olmOCR API Key is required!${NC}"
        read -p "Enter olmOCR API Key: " OLMOCR_KEY
    done
    
    # PostgreSQL Password
    echo -e "\n${YELLOW}Database Password${NC}"
    read -p "Enter PostgreSQL password (or press Enter for auto-generated): " POSTGRES_PASS
    if [ -z "$POSTGRES_PASS" ]; then
        POSTGRES_PASS=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
        log_info "Generated secure password: $POSTGRES_PASS"
    fi
    
    # Optional: Gemini API Key
    echo -e "\n${CYAN}Optional: Gemini API Key${NC}"
    read -p "Enter Gemini API Key (or press Enter to skip): " GEMINI_KEY
    
    # Optional: Anthropic API Key
    echo -e "\n${CYAN}Optional: Anthropic API Key${NC}"
    read -p "Enter Anthropic API Key (or press Enter to skip): " ANTHROPIC_KEY
    
    # CORS Origins
    echo -e "\n${CYAN}CORS Configuration${NC}"
    read -p "Enter allowed CORS origins (or press Enter for '*'): " CORS_ORIGINS
    CORS_ORIGINS=${CORS_ORIGINS:-"*"}
    
    # Create .env file
    log_info "Creating .env file..."
    cat > .env << EOF
# Clinical Study Extraction App - Environment Configuration
# Generated by setup.sh on $(date)

# Application
ENVIRONMENT=production
DEBUG=False
LOG_LEVEL=INFO
HOST=0.0.0.0
PORT=8000

# Database
POSTGRES_USER=postgres
POSTGRES_PASSWORD=$POSTGRES_PASS
POSTGRES_DB=clinical_study
DATABASE_URL=postgresql://postgres:$POSTGRES_PASS@db:5432/clinical_study

# Redis
REDIS_URL=redis://redis:6379/0

# olmOCR (Required)
OLMOCR_API_KEY=$OLMOCR_KEY
OLMOCR_PROVIDER=deepinfra
OLMOCR_ENABLED=true

# Optional AI Services
GEMINI_API_KEY=$GEMINI_KEY
ANTHROPIC_API_KEY=$ANTHROPIC_KEY

# CORS
CORS_ORIGINS=$CORS_ORIGINS

# File Upload
MAX_FILE_SIZE=100000000

# Frontend
REACT_APP_API_URL=http://$(curl -s ifconfig.me):8000
NODE_ENV=production
EOF
    
    chmod 600 .env
    log_info ".env file created successfully"
}

deploy_application() {
    log_step "Deploying application"
    
    cd "$INSTALL_DIR"
    
    log_info "Making deploy script executable..."
    chmod +x deploy-docker.sh
    
    log_info "Starting Docker containers..."
    ./deploy-docker.sh up
    
    log_info "Waiting for services to be ready..."
    sleep 15
    
    log_info "Checking service health..."
    if curl -f http://localhost:8000/health > /dev/null 2>&1; then
        log_info "Backend is healthy!"
    else
        log_warn "Backend health check failed, but containers are running"
        log_info "Check logs with: cd $INSTALL_DIR && ./deploy-docker.sh logs"
    fi
}

setup_systemd_service() {
    log_step "Setting up systemd service (optional)"
    
    read -p "Setup systemd service for auto-start on boot? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Skipping systemd service setup"
        return 0
    fi
    
    log_info "Creating systemd service..."
    sudo tee /etc/systemd/system/clinical-study-app.service > /dev/null << EOF
[Unit]
Description=Clinical Study Extraction App
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
User=$USER

[Install]
WantedBy=multi-user.target
EOF
    
    sudo systemctl daemon-reload
    sudo systemctl enable clinical-study-app.service
    
    log_info "Systemd service created and enabled"
}

print_summary() {
    SERVER_IP=$(curl -s ifconfig.me)
    
    echo -e "\n${GREEN}"
    cat << "EOF"
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║              🎉  Installation Complete!  🎉                   ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}"
    
    echo -e "${CYAN}📍 Installation Directory:${NC}"
    echo "   $INSTALL_DIR"
    echo ""
    
    echo -e "${CYAN}🌐 Access URLs:${NC}"
    echo "   Backend API:  http://$SERVER_IP:8000"
    echo "   API Docs:     http://$SERVER_IP:8000/docs"
    echo "   Frontend:     http://$SERVER_IP:3000"
    echo "   Health Check: http://$SERVER_IP:8000/health"
    echo ""
    
    echo -e "${CYAN}🛠️  Management Commands:${NC}"
    echo "   cd $INSTALL_DIR"
    echo "   ./deploy-docker.sh status    # Check status"
    echo "   ./deploy-docker.sh logs      # View logs"
    echo "   ./deploy-docker.sh restart   # Restart services"
    echo "   ./deploy-docker.sh backup    # Backup database"
    echo ""
    
    echo -e "${CYAN}📚 Documentation:${NC}"
    echo "   Deployment Guide: $INSTALL_DIR/DOCKER_DEPLOYMENT.md"
    echo "   Feature Overview: $INSTALL_DIR/FINAL_DELIVERY_SUMMARY.md"
    echo ""
    
    echo -e "${YELLOW}⚠️  Important Notes:${NC}"
    echo "   1. Your .env file is at: $INSTALL_DIR/.env"
    echo "   2. Database password: (saved in .env)"
    echo "   3. For SSL/HTTPS, see: $INSTALL_DIR/DOCKER_DEPLOYMENT.md"
    echo "   4. Firewall ports opened: 22, 80, 443, 8000, 3000"
    echo ""
    
    if [ "$EUID" -ne 0 ]; then
        echo -e "${YELLOW}⚠️  Docker Group:${NC}"
        echo "   You were added to the docker group."
        echo "   Log out and back in for changes to take effect."
        echo "   Or run: newgrp docker"
        echo ""
    fi
    
    echo -e "${GREEN}✅ Setup complete! Your application is now running.${NC}"
    echo ""
}

# Main execution
main() {
    print_banner
    
    log_step "Starting installation"
    
    check_root
    check_os
    install_dependencies
    install_docker
    install_docker_compose
    setup_firewall
    clone_repository
    configure_environment
    deploy_application
    setup_systemd_service
    print_summary
    
    log_info "Installation completed successfully!"
}

# Run main function
main "$@"
