# 🚀 Deployment Guide

This guide covers various deployment options for the Clinical Study Extraction System.

## Table of Contents
- [Docker Deployment](#docker-deployment)
- [Railway Deployment](#railway-deployment)
- [Vercel + Render Deployment](#vercel--render-deployment)
- [AWS Deployment](#aws-deployment)
- [Environment Variables](#environment-variables)

## Docker Deployment

### Using Docker Compose (Recommended for Local)

```bash
# Start both frontend and backend
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Backend Only (Docker)

```bash
cd backend
docker build -t clinical-study-backend .
docker run -p 8000:8000 \
  -e PORT=8000 \
  -e CORS_ORIGINS=http://localhost:3000 \
  clinical-study-backend
```

## Railway Deployment

### Backend on Railway

1. **Create New Project**
   - Go to [Railway](https://railway.app/)
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your repository

2. **Configure Backend**
   ```
   Root Directory: backend
   Build Command: pip install -r requirements.txt
   Start Command: uvicorn app.main:app --host 0.0.0.0 --port $PORT
   ```

3. **Set Environment Variables**
   ```
   PORT=8000
   HOST=0.0.0.0
   DEBUG=False
   CORS_ORIGINS=https://your-frontend-url.vercel.app
   ```

4. **Get Deployment URL**
   - Railway will provide: `https://your-app.railway.app`

### Frontend Configuration
Update frontend `.env`:
```env
VITE_API_BASE_URL=https://your-app.railway.app
```

## Vercel + Render Deployment

### Frontend on Vercel

1. **Deploy to Vercel**
   ```bash
   cd frontend
   npm install -g vercel
   vercel
   ```

2. **Configure Build Settings**
   - Framework Preset: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`

3. **Environment Variables**
   ```
   VITE_API_BASE_URL=https://your-backend.onrender.com
   VITE_GEMINI_API_KEY=your_key_here
   ```

### Backend on Render

1. **Create Web Service**
   - Go to [Render](https://render.com/)
   - New → Web Service
   - Connect GitHub repository

2. **Configure Service**
   ```
   Name: clinical-study-backend
   Root Directory: backend
   Environment: Python 3
   Build Command: pip install -r requirements.txt
   Start Command: uvicorn app.main:app --host 0.0.0.0 --port $PORT
   ```

3. **Environment Variables**
   ```
   PYTHON_VERSION=3.11
   CORS_ORIGINS=https://your-app.vercel.app
   DEBUG=False
   ```

## AWS Deployment

### Backend on AWS Elastic Beanstalk

1. **Install EB CLI**
   ```bash
   pip install awsebcli
   ```

2. **Initialize EB**
   ```bash
   cd backend
   eb init -p python-3.11 clinical-study-backend
   ```

3. **Create Environment**
   ```bash
   eb create production-env
   ```

4. **Deploy**
   ```bash
   eb deploy
   ```

5. **Set Environment Variables**
   ```bash
   eb setenv CORS_ORIGINS=https://your-frontend.com DEBUG=False
   ```

### Frontend on AWS S3 + CloudFront

1. **Build Frontend**
   ```bash
   cd frontend
   npm run build
   ```

2. **Create S3 Bucket**
   ```bash
   aws s3 mb s3://clinical-study-frontend
   ```

3. **Upload Build**
   ```bash
   aws s3 sync dist/ s3://clinical-study-frontend --acl public-read
   ```

4. **Configure CloudFront**
   - Create distribution
   - Origin: S3 bucket
   - Default root object: `index.html`
   - Enable HTTPS

## Environment Variables

### Backend Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Server port | `8000` |
| `HOST` | Server host | `0.0.0.0` |
| `CORS_ORIGINS` | Allowed origins | `http://localhost:3000` |
| `DEBUG` | Debug mode | `False` |
| `MAX_FILE_SIZE` | Max upload size | `50000000` |

### Frontend Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | Backend URL | `http://localhost:8000` |
| `VITE_GEMINI_API_KEY` | Gemini API key | `AIza...` |
| `VITE_ENABLE_AI_FEATURES` | Enable AI | `true` |

## Health Checks

### Backend Health Check
```bash
curl https://your-backend-url.com/health
```

Expected response:
```json
{"status": "healthy", "version": "1.0.0"}
```

### Frontend Health Check
Access your frontend URL and verify:
- PDF viewer loads
- Backend connection works (check browser console)
- AI features respond

## SSL/HTTPS Configuration

### Using Let's Encrypt (for self-hosted)

```bash
# Install certbot
sudo apt-get install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal
sudo certbot renew --dry-run
```

## Monitoring

### Backend Monitoring

**Health endpoint**: `/health`
**Metrics endpoint**: `/metrics` (if implemented)

**Recommended tools**:
- Sentry (error tracking)
- Datadog (performance monitoring)
- CloudWatch (AWS)

### Frontend Monitoring

**Recommended tools**:
- Vercel Analytics
- Google Analytics
- LogRocket (session replay)

## Backup Strategy

### Database Backups (if using database)
```bash
# PostgreSQL
pg_dump dbname > backup.sql

# Automated daily backups
0 2 * * * pg_dump dbname > /backups/backup-$(date +\%Y\%m\%d).sql
```

### User Data Exports
Ensure users can export their extraction data in multiple formats (JSON, CSV, Excel).

## Scaling

### Horizontal Scaling (Multiple Instances)

**Docker Compose with Replicas**:
```yaml
services:
  backend:
    deploy:
      replicas: 3
```

**Load Balancer** (Nginx):
```nginx
upstream backend {
    server backend1:8000;
    server backend2:8000;
    server backend3:8000;
}
```

### Vertical Scaling

**Railway/Render**: Increase instance size via dashboard
**AWS**: Change instance type
**Docker**: Adjust resource limits

## Troubleshooting

### CORS Errors
- Verify `CORS_ORIGINS` includes your frontend URL
- Check protocol (http vs https)
- Ensure no trailing slashes

### File Upload Fails
- Check `MAX_FILE_SIZE` setting
- Verify disk space on server
- Check file permissions

### Slow Performance
- Enable caching (Redis)
- Optimize PDF processing (reduce DPI)
- Use CDN for frontend assets
- Scale horizontally

## Cost Estimates

### Free Tier Options
- **Frontend**: Vercel (free hobby plan)
- **Backend**: Render (free tier with limitations)
- **Total**: $0/month for testing

### Production Costs
- **Frontend**: Vercel Pro ($20/month)
- **Backend**: Render Standard ($7-25/month)
- **Database**: (if needed) $5-15/month
- **Total**: ~$30-60/month

---

**Need Help?** Open an issue on GitHub or check the main README.md.
