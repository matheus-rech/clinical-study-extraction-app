#!/bin/bash

# GitHub Actions Secrets Setup Script
# This script helps you set up the required secrets for GitHub Actions workflows

set -e

echo "=========================================="
echo "GitHub Actions Secrets Setup"
echo "=========================================="
echo ""
echo "This script will help you configure secrets for:"
echo "  1. VPS Deployment"
echo "  2. Railway Deployment"
echo "  3. Split Deployment (Vercel + Railway)"
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo -e "${RED}Error: GitHub CLI (gh) is not installed.${NC}"
    echo "Install it from: https://cli.github.com/"
    exit 1
fi

# Check if user is authenticated
if ! gh auth status &> /dev/null; then
    echo -e "${YELLOW}You need to authenticate with GitHub CLI first.${NC}"
    echo "Run: gh auth login"
    exit 1
fi

echo -e "${GREEN}✓ GitHub CLI is installed and authenticated${NC}"
echo ""

# Function to set a secret
set_secret() {
    local secret_name=$1
    local secret_description=$2
    local is_required=$3

    echo -e "${YELLOW}${secret_name}${NC}"
    echo "  Description: ${secret_description}"

    if [ "$is_required" == "required" ]; then
        echo -e "  ${RED}[REQUIRED]${NC}"
    else
        echo -e "  ${GREEN}[OPTIONAL]${NC}"
    fi

    read -p "  Enter value (or press Enter to skip): " secret_value

    if [ -n "$secret_value" ]; then
        echo "$secret_value" | gh secret set "$secret_name"
        echo -e "  ${GREEN}✓ Secret set successfully${NC}"
    else
        echo -e "  ${YELLOW}⊘ Skipped${NC}"
    fi
    echo ""
}

# Function to generate a secret key
generate_secret_key() {
    openssl rand -hex 32
}

echo "=========================================="
echo "Deployment Strategy Selection"
echo "=========================================="
echo ""
echo "Choose your deployment strategy:"
echo "  1. VPS Deployment (DigitalOcean, AWS, etc.)"
echo "  2. Railway Full Stack"
echo "  3. Split Deployment (Vercel + Railway)"
echo "  4. All of the above"
echo ""
read -p "Enter your choice (1-4): " deployment_choice
echo ""

# Common secrets for all deployments
echo "=========================================="
echo "Common Application Secrets"
echo "=========================================="
echo ""

echo "Generating SECRET_KEY..."
SECRET_KEY=$(generate_secret_key)
echo -e "${GREEN}Generated: ${SECRET_KEY}${NC}"
read -p "Press Enter to set this secret, or input your own: " custom_key
if [ -n "$custom_key" ]; then
    SECRET_KEY=$custom_key
fi
echo "$SECRET_KEY" | gh secret set SECRET_KEY
echo -e "${GREEN}✓ SECRET_KEY set${NC}"
echo ""

set_secret "ENTREZ_EMAIL" "Email for PubMed/NCBI API access" "required"
set_secret "GEMINI_API_KEY" "Google Gemini API key (for AI features)" "optional"

# VPS-specific secrets
if [ "$deployment_choice" == "1" ] || [ "$deployment_choice" == "4" ]; then
    echo "=========================================="
    echo "VPS Deployment Secrets"
    echo "=========================================="
    echo ""

    set_secret "VPS_HOST" "VPS IP address or hostname (e.g., 123.45.67.89)" "required"
    set_secret "VPS_USER" "SSH user (e.g., root, ubuntu)" "required"
    set_secret "DEPLOY_PATH" "Deployment directory (e.g., /opt/clinical-study-app)" "required"
    set_secret "APP_URL" "Your app's public URL (e.g., https://app.example.com)" "required"

    echo -e "${YELLOW}SSH_PRIVATE_KEY${NC}"
    echo "  Description: SSH private key for VPS access"
    echo -e "  ${RED}[REQUIRED]${NC}"
    echo ""
    echo "To generate an SSH key:"
    echo "  1. Run: ssh-keygen -t ed25519 -C 'github-actions' -f ~/.ssh/github_actions"
    echo "  2. Copy public key to VPS: ssh-copy-id -i ~/.ssh/github_actions.pub user@vps-host"
    echo "  3. Copy private key: cat ~/.ssh/github_actions"
    echo ""
    read -p "Enter SSH private key path (or press Enter to skip): " ssh_key_path
    if [ -n "$ssh_key_path" ]; then
        if [ -f "$ssh_key_path" ]; then
            gh secret set SSH_PRIVATE_KEY < "$ssh_key_path"
            echo -e "${GREEN}✓ SSH_PRIVATE_KEY set${NC}"
        else
            echo -e "${RED}Error: File not found${NC}"
        fi
    else
        echo -e "${YELLOW}⊘ Skipped - Set this manually in GitHub Settings${NC}"
    fi
    echo ""

    set_secret "CORS_ORIGINS" "Comma-separated allowed origins (e.g., https://app.example.com)" "required"
    set_secret "VITE_API_BASE_URL" "Backend URL for frontend (e.g., https://api.example.com)" "required"
fi

# Railway-specific secrets
if [ "$deployment_choice" == "2" ] || [ "$deployment_choice" == "4" ]; then
    echo "=========================================="
    echo "Railway Deployment Secrets"
    echo "=========================================="
    echo ""

    echo "To get Railway credentials:"
    echo "  1. Go to https://railway.app/"
    echo "  2. Create a new project"
    echo "  3. Go to Account Settings → Tokens → Create Token"
    echo "  4. Copy the token and project ID"
    echo ""

    set_secret "RAILWAY_TOKEN" "Railway API token" "required"
    set_secret "RAILWAY_PROJECT_ID" "Railway project ID" "required"
    set_secret "RAILWAY_BACKEND_URL" "Backend service URL (from Railway dashboard)" "required"
    set_secret "RAILWAY_FRONTEND_URL" "Frontend service URL (from Railway dashboard)" "required"

    # Set CORS_ORIGINS to include Railway URLs
    echo "Make sure to update CORS_ORIGINS to include Railway frontend URL!"
fi

# Vercel + Railway split deployment
if [ "$deployment_choice" == "3" ] || [ "$deployment_choice" == "4" ]; then
    echo "=========================================="
    echo "Vercel + Railway Split Deployment"
    echo "=========================================="
    echo ""

    echo "To get Vercel credentials:"
    echo "  1. Install Vercel CLI: npm install -g vercel"
    echo "  2. Run: cd frontend && vercel login && vercel link"
    echo "  3. Check .vercel/project.json for IDs"
    echo "  4. Get token from: https://vercel.com/account/tokens"
    echo ""

    set_secret "VERCEL_TOKEN" "Vercel API token" "required"
    set_secret "VERCEL_ORG_ID" "Vercel organization ID" "required"
    set_secret "VERCEL_PROJECT_ID" "Vercel project ID" "required"

    # Railway backend only
    if [ "$deployment_choice" == "3" ]; then
        set_secret "RAILWAY_TOKEN" "Railway API token (for backend only)" "required"
        set_secret "RAILWAY_PROJECT_ID" "Railway project ID" "required"
        set_secret "RAILWAY_BACKEND_URL" "Backend service URL" "required"
    fi
fi

echo ""
echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
echo -e "${GREEN}✓ Secrets have been configured${NC}"
echo ""
echo "Next steps:"
echo "  1. Review secrets in GitHub: Settings → Secrets and variables → Actions"
echo "  2. Push your code to trigger workflows"
echo "  3. Monitor deployments in the Actions tab"
echo ""
echo "Additional setup:"
echo "  - For VPS: Set up reverse proxy (Caddy/Nginx) for HTTPS"
echo "  - For Railway: Configure custom domains in Railway dashboard"
echo "  - For Vercel: Configure environment variables in Vercel dashboard"
echo ""
echo "Documentation: .github/workflows/README.md"
echo ""
