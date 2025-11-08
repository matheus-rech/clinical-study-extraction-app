# 🚀 Production Setup Guide

Complete guide for deploying the Clinical Study Extraction System to production.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Production Configuration](#production-configuration)
4. [Docker Deployment](#docker-deployment)
5. [Platform-Specific Guides](#platform-specific-guides)
6. [Security Checklist](#security-checklist)
7. [Monitoring & Maintenance](#monitoring--maintenance)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### System Requirements

- **Docker**: 20.10+ and Docker Compose 2.0+
- **Memory**: Minimum 2GB RAM (4GB recommended)
- **CPU**: 2+ cores recommended
- **Storage**: 10GB+ free space

### Required Accounts (Choose One)

- **Railway** + **Vercel** (Free tier available)
- **Render** (Free tier with limitations)
- **DigitalOcean**, **AWS**, **Azure**, or **GCP** (Paid)

---

## Quick Start

### 1. Clone and Configure

```bash
# Clone the repository
git clone https://github.com/matheus-rech/clinical-study-extraction-app.git
cd clinical-study-extraction-app

# Copy and configure production environment
cp .env.production.example .env.production

# Edit with your production values
nano .env.production
```

### 2. Update Production Environment

Edit `.env.production` with your values:

```bash
# CRITICAL: Update these values!
SECRET_KEY=$(openssl rand -hex 32)
CORS_ORIGINS=https://your-frontend-url.com
VITE_API_BASE_URL=https://your-backend-url.com
VITE_GEMINI_API_KEY=your_gemini_api_key
ENTREZ_EMAIL=your-email@example.com
```

### 3. Test Locally

```bash
# Load environment variables safely
set -a; source .env.production; set +a

# Start production containers
docker-compose -f docker-compose.prod.yml up -d

# Verify deployment
./verify-deployment.sh
```

### 4. Access Your Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

---

## Production Configuration

### Backend Configuration

Edit `backend/.env` or set environment variables:

```bash
# Application
ENVIRONMENT=production
DEBUG=False

# CORS - MUST match your frontend URL
CORS_ORIGINS=https://your-frontend.com

# Security
SECRET_KEY=your-secure-random-key-here
ALLOWED_HOSTS=your-backend.com

# Performance
MAX_WORKERS=4
LOG_LEVEL=INFO
```

### Frontend Configuration

Edit `frontend/.env` or set environment variables:

```bash
# API Connection
VITE_API_BASE_URL=https://your-backend.com

# AI Features
VITE_GEMINI_API_KEY=your_gemini_api_key
VITE_ENABLE_AI_FEATURES=true
```

### Security Best Practices

1. **Secret Key**: Generate secure random key
   ```bash
   openssl rand -hex 32
   ```

2. **CORS**: Never use `*` in production
   ```bash
   CORS_ORIGINS=https://your-frontend.com,https://www.your-frontend.com
   ```

3. **HTTPS**: Always use HTTPS in production
4. **Environment Variables**: Never commit `.env` files
5. **API Keys**: Use separate keys for production

---

## Docker Deployment

### Production Docker Compose

The `docker-compose.prod.yml` file includes:

- ✅ Production-optimized builds
- ✅ Health checks
- ✅ Resource limits
- ✅ Automatic restarts
- ✅ Network isolation

### Commands

```bash
# Start services
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Stop services
docker-compose -f docker-compose.prod.yml down

# Rebuild after changes
docker-compose -f docker-compose.prod.yml up -d --build

# Check service status
docker-compose -f docker-compose.prod.yml ps
```

### Resource Management

Default resource limits (adjust in `docker-compose.prod.yml`):

- **Backend**: 2 CPU cores, 2GB RAM
- **Frontend**: 1 CPU core, 512MB RAM

---

## Platform-Specific Guides

### Option 1: Railway + Vercel (Recommended for Free Tier)

#### Deploy Backend to Railway

1. Go to https://railway.app/
2. Sign in with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your repository
5. Configure:
   - **Root Directory**: `backend`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

6. Add Environment Variables:
   ```
   ENVIRONMENT=production
   DEBUG=False
   CORS_ORIGINS=https://your-app.vercel.app
   SECRET_KEY=your-secret-key
   LOG_LEVEL=INFO
   ```

7. Deploy and copy the Railway URL

#### Deploy Frontend to Vercel

1. Go to https://vercel.com/
2. Sign in with GitHub
3. Click "New Project" → Import your repository
4. Configure:
   - **Root Directory**: `frontend`
   - **Framework Preset**: Static
   - **Build Command**: (leave empty)
   - **Output Directory**: `public`

5. Add Environment Variables:
   ```
   VITE_API_BASE_URL=https://your-app.railway.app
   VITE_GEMINI_API_KEY=your_gemini_key
   VITE_ENABLE_AI_FEATURES=true
   ```

6. Deploy and get your Vercel URL

7. **Update Railway CORS**: Go back to Railway and update `CORS_ORIGINS` with your Vercel URL

### Option 2: Render (Full Stack on One Platform)

#### Backend Service

1. Go to https://render.com/
2. New → Web Service
3. Connect GitHub repository
4. Configure:
   ```
   Name: clinical-study-backend
   Root Directory: backend
   Environment: Python 3
   Build Command: pip install -r requirements.txt
   Start Command: uvicorn app.main:app --host 0.0.0.0 --port $PORT
   ```

5. Add environment variables (same as Railway)

#### Frontend Static Site

1. New → Static Site
2. Connect same repository
3. Configure:
   ```
   Name: clinical-study-frontend
   Root Directory: frontend
   Build Command: echo "No build needed"
   Publish Directory: public
   ```

4. Add environment variables for frontend

### Option 3: DigitalOcean App Platform

1. Go to https://www.digitalocean.com/
2. Create → Apps
3. Connect GitHub repository
4. Add two components:
   - **Backend**: Web Service (Python)
   - **Frontend**: Static Site

5. Configure environment variables for both
6. Deploy

### Option 4: Docker on Any Cloud (AWS, Azure, GCP, etc.)

```bash
# Build images
docker-compose -f docker-compose.prod.yml build

# Tag for your registry
docker tag clinical-study-backend your-registry/backend:latest
docker tag clinical-study-frontend your-registry/frontend:latest

# Push to registry
docker push your-registry/backend:latest
docker push your-registry/frontend:latest

# Deploy on your cloud platform using these images
```

---

## Security Checklist

Before deploying to production:

- [ ] Generate secure `SECRET_KEY`
- [ ] Set specific `CORS_ORIGINS` (no wildcards)
- [ ] Use HTTPS for all URLs
- [ ] Set `DEBUG=False`
- [ ] Set `ENVIRONMENT=production`
- [ ] Update `ALLOWED_HOSTS` with your domain
- [ ] Use production API keys
- [ ] Set up proper logging
- [ ] Enable health checks
- [ ] Configure resource limits
- [ ] Set up monitoring/alerts
- [ ] Review all environment variables
- [ ] Never commit `.env` files

---

## Monitoring & Maintenance

### Health Checks

```bash
# Backend health
curl https://your-backend.com/health

# Expected response:
# {"status":"healthy","service":"PDF Processing API"}
```

### Logs

```bash
# Docker logs
docker-compose -f docker-compose.prod.yml logs -f backend
docker-compose -f docker-compose.prod.yml logs -f frontend

# Platform-specific logs
# Railway: Dashboard → Logs tab
# Render: Service → Logs tab
# Vercel: Deployment → Function Logs
```

### Common Maintenance Tasks

```bash
# Update application
git pull origin main
docker-compose -f docker-compose.prod.yml up -d --build

# Restart services
docker-compose -f docker-compose.prod.yml restart

# Check resource usage
docker stats

# Clean up old images
docker image prune -a
```

---

## Troubleshooting

### Backend Won't Start

**Check logs:**
```bash
docker-compose -f docker-compose.prod.yml logs backend
```

**Common issues:**
- Missing environment variables
- Invalid SECRET_KEY
- Port already in use
- Insufficient memory

### Frontend Can't Connect to Backend

**Check:**
1. `VITE_API_BASE_URL` is set correctly
2. `CORS_ORIGINS` includes frontend URL
3. Backend is running: `curl https://backend-url/health`
4. Network connectivity between services

**Test CORS:**
```bash
curl -H "Origin: https://your-frontend.com" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS \
     https://your-backend.com/api/extract-tables
```

### PDF Extraction Fails

**Check:**
1. File size under `MAX_FILE_SIZE` (default 50MB)
2. PDF is not password-protected
3. Backend has enough memory
4. All dependencies installed correctly

### AI Features Not Working

**Check:**
1. `VITE_GEMINI_API_KEY` is set
2. API key is valid at https://aistudio.google.com/
3. Check browser console for errors (F12)

### Performance Issues

**Solutions:**
1. Increase `MAX_WORKERS` in backend
2. Add more CPU/memory resources
3. Enable caching
4. Use a CDN for frontend
5. Optimize Docker image sizes

---

## Post-Deployment Checklist

After deployment:

- [ ] Test with real clinical study PDFs
- [ ] Verify all extraction features work
- [ ] Test AI features
- [ ] Check export functionality
- [ ] Monitor resource usage
- [ ] Set up automated backups (if storing data)
- [ ] Configure custom domain (optional)
- [ ] Set up SSL/TLS certificates
- [ ] Enable monitoring/alerting
- [ ] Document your deployment

---

## Support

- **Documentation**: See `README.md` and `DEPLOY_NOW.md`
- **Issues**: https://github.com/matheus-rech/clinical-study-extraction-app/issues
- **Railway Docs**: https://docs.railway.app/
- **Render Docs**: https://render.com/docs
- **Vercel Docs**: https://vercel.com/docs

---

## Cost Estimates

| Platform | Monthly Cost | Free Tier | Best For |
|----------|--------------|-----------|----------|
| Railway + Vercel | $0-5 | ✅ 500 hours | Testing, MVP |
| Render | $7 | ✅ 750 hours | Small production |
| DigitalOcean | $12-20 | ❌ | Medium traffic |
| AWS/Azure/GCP | $20-50+ | ✅ Limited | Enterprise |

---

**Ready to deploy?** Start with the [Quick Start](#quick-start) section above!
