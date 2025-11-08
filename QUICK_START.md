# ⚡ Quick Start Guide

Get the Clinical Study Extraction System running in 5 minutes!

## Option 1: Local Development (Fastest)

### Prerequisites
- Docker and Docker Compose installed
- Git installed

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/matheus-rech/clinical-study-extraction-app.git
cd clinical-study-extraction-app

# 2. Start development environment
docker-compose up -d

# 3. Access the application
# Frontend: http://localhost:3000
# Backend:  http://localhost:8000
# API Docs: http://localhost:8000/docs
```

That's it! The application is now running locally.

---

## Option 2: Local Production Test

Test production configuration locally:

```bash
# 1. Create production environment
cp .env.production.example .env.production
# Edit .env.production with your values

# 2. Run deployment script
./deploy-local.sh

# This will:
# - Build production images
# - Start containers
# - Run health checks
# - Show access URLs
```

---

## Option 3: Deploy to Cloud (10 minutes)

### Railway + Vercel (Free Tier)

**Backend (Railway):**
1. Go to https://railway.app/
2. Sign in with GitHub
3. New Project → Deploy from GitHub
4. Select your repo, root: `backend`
5. Add env vars:
   ```
   ENVIRONMENT=production
   DEBUG=False
   CORS_ORIGINS=https://your-frontend.vercel.app
   ```

**Frontend (Vercel):**
1. Go to https://vercel.com/
2. New Project → Import from GitHub
3. Root directory: `frontend`
4. Add env vars:
   ```
   VITE_API_BASE_URL=https://your-backend.railway.app
   VITE_GEMINI_API_KEY=your_key
   ```

---

## Next Steps

- 📚 Read full documentation: [README.md](README.md)
- 🚀 Production setup guide: [PRODUCTION_SETUP.md](PRODUCTION_SETUP.md)
- 🎯 Deployment options: [DEPLOY_NOW.md](DEPLOY_NOW.md)

---

## Common Commands

```bash
# Development
docker-compose up -d              # Start
docker-compose logs -f            # View logs
docker-compose down               # Stop

# Production
docker-compose -f docker-compose.prod.yml up -d
./verify-deployment.sh            # Check health

# Testing
curl http://localhost:8000/health # Backend health
curl http://localhost:3000        # Frontend
```

---

## Troubleshooting

**Port already in use:**
```bash
# Change ports in docker-compose.yml
ports:
  - "8001:8000"  # Use 8001 instead of 8000
```

**Docker not running:**
```bash
# Start Docker Desktop or Docker daemon
# Then retry: docker-compose up -d
```

**Can't connect frontend to backend:**
- Check CORS_ORIGINS includes your frontend URL
- Verify VITE_API_BASE_URL is correct
- Ensure backend is running: `curl http://localhost:8000/health`

---

## Need Help?

- 📖 Full docs: [README.md](README.md)
- 🐛 Report issues: [GitHub Issues](https://github.com/matheus-rech/clinical-study-extraction-app/issues)
- 💬 Check existing issues for solutions
