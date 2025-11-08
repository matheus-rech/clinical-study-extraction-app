# Docker Compose Deployment Guide

Complete guide for deploying the Clinical Study Extraction App using Docker Compose with CI/CD via GitHub Actions.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Configuration](#configuration)
4. [Deployment](#deployment)
5. [GitHub Actions CI/CD](#github-actions-cicd)
6. [Database Management](#database-management)
7. [Monitoring & Logs](#monitoring--logs)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software
- **Docker**: 20.10+ ([Install Docker](https://docs.docker.com/get-docker/))
- **Docker Compose**: 2.0+ ([Install Compose](https://docs.docker.com/compose/install/))
- **Git**: For cloning and updates

### System Requirements
- **CPU**: 2+ cores recommended
- **RAM**: 4GB+ recommended
- **Disk**: 10GB+ free space
- **OS**: Linux, macOS, or Windows with WSL2

---

## Quick Start

### 1. Clone Repository
```bash
git clone https://github.com/matheus-rech/clinical-study-extraction-app.git
cd clinical-study-extraction-app
```

### 2. Configure Environment
```bash
# Copy environment template
cp .env.example .env

# Edit configuration
nano .env
```

**Minimum required configuration:**
```bash
OLMOCR_API_KEY=your_deepinfra_api_key_here
POSTGRES_PASSWORD=your_secure_password_here
```

### 3. Deploy
```bash
# Make script executable
chmod +x deploy-docker.sh

# Start all services
./deploy-docker.sh up
```

### 4. Verify Deployment
```bash
# Check service status
./deploy-docker.sh status

# Check health
./deploy-docker.sh health
```

**Access the application:**
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs
- Frontend: http://localhost:3000

---

## Configuration

### Environment Variables

#### Application Settings
```bash
ENVIRONMENT=production          # production, development, staging
DEBUG=False                     # Enable debug mode
LOG_LEVEL=INFO                  # DEBUG, INFO, WARNING, ERROR
```

#### Database Configuration
```bash
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_password_here
POSTGRES_DB=clinical_study
DATABASE_URL=postgresql://postgres:password@db:5432/clinical_study
```

#### Redis Cache
```bash
REDIS_URL=redis://redis:6379/0
```

#### API Keys
```bash
# olmOCR (Required for VLM-based extraction)
OLMOCR_API_KEY=your_deepinfra_api_key_here
OLMOCR_PROVIDER=deepinfra
OLMOCR_ENABLED=true

# Optional AI services
GEMINI_API_KEY=your_gemini_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

#### CORS & Security
```bash
CORS_ORIGINS=*                  # Comma-separated list or *
MAX_FILE_SIZE=100000000         # 100MB in bytes
```

---

## Deployment

### Docker Compose Services

The application consists of 5 services:

1. **backend** - FastAPI application (Port 8000)
2. **frontend** - React application (Port 3000)
3. **db** - PostgreSQL database (Port 5432)
4. **redis** - Redis cache (Port 6379)
5. **nginx** - Reverse proxy (Ports 80, 443)

### Deployment Commands

#### Start Services
```bash
./deploy-docker.sh up
```

#### Stop Services
```bash
./deploy-docker.sh down
```

#### Restart Services
```bash
./deploy-docker.sh restart
```

#### View Logs
```bash
# All services
./deploy-docker.sh logs

# Specific service
./deploy-docker.sh logs backend
./deploy-docker.sh logs db
```

#### Check Status
```bash
./deploy-docker.sh status
```

#### Health Check
```bash
./deploy-docker.sh health
```

---

## GitHub Actions CI/CD

### Setup

#### 1. Configure GitHub Secrets

Go to your repository → Settings → Secrets and variables → Actions

Add the following secrets:

**Required Secrets:**
```
OLMOCR_API_KEY          # DeepInfra API key
DEPLOY_HOST             # Server IP or domain
DEPLOY_USER             # SSH username (e.g., ubuntu)
DEPLOY_SSH_KEY          # Private SSH key for deployment
DEPLOY_PATH             # Deployment path (e.g., /opt/clinical-study-extraction-app)
```

**Optional Secrets:**
```
POSTGRES_PASSWORD       # Database password
GEMINI_API_KEY         # Gemini API key
ANTHROPIC_API_KEY      # Anthropic API key
SLACK_WEBHOOK          # Slack notification webhook
```

#### 2. Prepare Deployment Server

```bash
# On your deployment server
sudo mkdir -p /opt/clinical-study-extraction-app
sudo chown $USER:$USER /opt/clinical-study-extraction-app

# Clone repository
cd /opt/clinical-study-extraction-app
git clone https://github.com/matheus-rech/clinical-study-extraction-app.git .

# Create .env file
cp .env.example .env
nano .env  # Configure with your values
```

#### 3. Enable GitHub Actions

The workflow (`.github/workflows/deploy.yml`) will automatically:
- ✅ Build and test on every push
- ✅ Build Docker images
- ✅ Push to GitHub Container Registry
- ✅ Deploy to production (main branch)
- ✅ Deploy to staging (develop branch)

### Workflow Triggers

- **Push to `main`**: Deploys to production
- **Push to `develop`**: Deploys to staging
- **Pull Request**: Runs tests only
- **Manual**: Can be triggered manually

### Manual Deployment Trigger

```bash
# Via GitHub UI
Repository → Actions → Build, Test, and Deploy → Run workflow

# Via GitHub CLI
gh workflow run deploy.yml
```

---

## Database Management

### Backup Database

```bash
./deploy-docker.sh backup
```

This creates a backup file: `backup_YYYYMMDD_HHMMSS.sql`

### Restore Database

```bash
./deploy-docker.sh restore backup_20250108_120000.sql
```

### Access Database

```bash
# Via psql
docker exec -it clinical-study-db psql -U postgres -d clinical_study

# View tables
\dt

# Query data
SELECT * FROM documents LIMIT 10;
```

### Database Schema

The database includes tables for:
- `documents` - Uploaded PDF files
- `extracted_tables` - Table extraction results
- `extracted_figures` - Figure extraction results
- `form_answers` - Form data and annotations
- `extraction_jobs` - Async job tracking
- `export_history` - Export operations log
- `api_usage` - API cost tracking

---

## Monitoring & Logs

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f db
docker-compose logs -f redis
```

### Service Status

```bash
docker-compose ps
```

### Resource Usage

```bash
docker stats
```

### Health Checks

```bash
# Backend health
curl http://localhost:8000/health

# Database health
docker exec clinical-study-db pg_isready -U postgres

# Redis health
docker exec clinical-study-redis redis-cli ping
```

---

## Troubleshooting

### Common Issues

#### 1. Port Already in Use

**Error**: `Bind for 0.0.0.0:8000 failed: port is already allocated`

**Solution**:
```bash
# Find process using port
lsof -ti:8000

# Kill process
kill $(lsof -ti:8000)

# Or change port in .env
BACKEND_PORT=8001
```

#### 2. Database Connection Failed

**Error**: `could not connect to server: Connection refused`

**Solution**:
```bash
# Check if database is running
docker-compose ps db

# View database logs
docker-compose logs db

# Restart database
docker-compose restart db
```

#### 3. Out of Memory

**Error**: `Cannot allocate memory`

**Solution**:
```bash
# Increase Docker memory limit
# Docker Desktop → Settings → Resources → Memory

# Or reduce workers in docker-compose.yml
# Change: --workers 4
# To: --workers 2
```

#### 4. Permission Denied

**Error**: `Permission denied: '/app/uploads'`

**Solution**:
```bash
# Fix permissions
docker-compose exec backend chown -R appuser:appuser /app/uploads
docker-compose exec backend chmod -R 755 /app/uploads
```

### Clean Installation

If you encounter persistent issues:

```bash
# Stop and remove everything
./deploy-docker.sh clean

# Remove all Docker data
docker system prune -a --volumes

# Start fresh
./deploy-docker.sh up
```

---

## Production Deployment

### SSL/HTTPS Configuration

1. **Obtain SSL Certificate**:
```bash
# Using Let's Encrypt
sudo apt-get install certbot
sudo certbot certonly --standalone -d your-domain.com
```

2. **Copy Certificates**:
```bash
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem nginx/ssl/
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem nginx/ssl/
```

3. **Enable HTTPS in Nginx**:
Edit `nginx/conf.d/default.conf` and uncomment the HTTPS server block.

4. **Restart Nginx**:
```bash
docker-compose restart nginx
```

### Security Best Practices

1. **Change Default Passwords**:
```bash
# Generate secure password
openssl rand -base64 32

# Update in .env
POSTGRES_PASSWORD=your_generated_password
```

2. **Restrict CORS**:
```bash
# In .env
CORS_ORIGINS=https://your-domain.com
```

3. **Enable Firewall**:
```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp
sudo ufw enable
```

4. **Regular Updates**:
```bash
# Update application
./deploy-docker.sh update

# Update system
sudo apt-get update && sudo apt-get upgrade
```

---

## Scaling

### Horizontal Scaling

Increase backend workers:

```yaml
# In docker-compose.yml
backend:
  command: ["python3.11", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "8"]
```

### Load Balancing

For multiple instances, use Nginx upstream:

```nginx
upstream backend {
    server backend1:8000;
    server backend2:8000;
    server backend3:8000;
}
```

---

## Support

For issues or questions:
- **GitHub Issues**: https://github.com/matheus-rech/clinical-study-extraction-app/issues
- **Documentation**: Check `DEPLOYMENT_COMPLETE.md`
- **Logs**: Always check logs first: `./deploy-docker.sh logs`

---

**Last Updated**: November 8, 2025  
**Version**: 1.0.0
