# 🚀 Deploy Your App in 10 Minutes

## Option 1: Railway + Vercel (Recommended - FREE Tier Available)

### Step 1: Deploy Backend to Railway (5 minutes)

1. **Go to Railway**: https://railway.app/
2. **Sign in with GitHub**
3. **Click "New Project"**
4. **Select "Deploy from GitHub repo"**
5. **Choose**: `matheus-rech/clinical-study-extraction-app`
6. **Configure**:
   - Root Directory: `backend`
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

7. **Add Environment Variables** (Settings → Variables):
   ```
   PORT=8000
   HOST=0.0.0.0
   DEBUG=False
   CORS_ORIGINS=https://your-frontend-url.vercel.app
   MAX_FILE_SIZE=50000000
   ```

8. **Deploy** - Railway will give you a URL like: `https://your-app.railway.app`

9. **Copy this URL** - you'll need it for frontend

### Step 2: Deploy Frontend to Vercel (5 minutes)

1. **Go to Vercel**: https://vercel.com/
2. **Sign in with GitHub**
3. **Click "Add New Project"**
4. **Import**: `matheus-rech/clinical-study-extraction-app`
5. **Configure**:
   - Root Directory: `frontend`
   - Framework Preset: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`

6. **Add Environment Variables**:
   ```
   VITE_API_BASE_URL=https://your-app.railway.app
   VITE_GEMINI_API_KEY=AIzaSyDTIPrQLPSMr35Ag53LdV37EUK4lbjvroI
   VITE_ENABLE_AI_FEATURES=true
   VITE_ENABLE_BACKEND_EXTRACTION=true
   ```

7. **Deploy** - Vercel will give you: `https://your-app.vercel.app`

8. **Update Railway CORS**:
   - Go back to Railway
   - Update `CORS_ORIGINS` to your Vercel URL
   - Redeploy

### ✅ Done! Your app is live at `https://your-app.vercel.app`

---

## Option 2: Render (Backend + Frontend on Same Platform)

### Deploy Backend

1. **Go to Render**: https://render.com/
2. **Sign in with GitHub**
3. **New → Web Service**
4. **Connect**: `matheus-rech/clinical-study-extraction-app`
5. **Configure**:
   ```
   Name: clinical-study-backend
   Root Directory: backend
   Environment: Python 3
   Build Command: pip install -r requirements.txt
   Start Command: uvicorn app.main:app --host 0.0.0.0 --port $PORT
   ```

6. **Environment Variables**:
   ```
   PYTHON_VERSION=3.11
   CORS_ORIGINS=https://your-frontend.onrender.com
   DEBUG=False
   ```

7. **Create Service** - Get URL: `https://clinical-study-backend.onrender.com`

### Deploy Frontend

1. **New → Static Site**
2. **Connect**: Same repo
3. **Configure**:
   ```
   Name: clinical-study-frontend
   Root Directory: frontend
   Build Command: npm run build
   Publish Directory: dist
   ```

4. **Environment Variables**:
   ```
   VITE_API_BASE_URL=https://clinical-study-backend.onrender.com
   VITE_GEMINI_API_KEY=AIzaSyDTIPrQLPSMr35Ag53LdV37EUK4lbjvroI
   ```

5. **Create Static Site**

6. **Update backend CORS** with frontend URL

### ✅ Done! Both services on Render

---

## Option 3: Docker on Any Cloud (AWS, Azure, GCP, DigitalOcean)

### Local Docker Test First

```bash
cd /tmp/claude/clinical-study-extraction-app

# Create production .env files
echo "PORT=8000
HOST=0.0.0.0
DEBUG=False
CORS_ORIGINS=http://localhost:3000" > backend/.env

echo "VITE_API_BASE_URL=http://localhost:8000
VITE_GEMINI_API_KEY=AIzaSyDTIPrQLPSMr35Ag53LdV37EUK4lbjvroI" > frontend/.env

# Start everything
docker-compose up -d

# Check logs
docker-compose logs -f

# Test
# Frontend: http://localhost:3000
# Backend: http://localhost:8000/docs
```

### Deploy to DigitalOcean App Platform

1. **Go to DigitalOcean**: https://www.digitalocean.com/
2. **Create → App**
3. **Connect GitHub**: `matheus-rech/clinical-study-extraction-app`
4. **Configure Components**:

   **Backend Service**:
   ```
   Type: Web Service
   Source: backend/
   Build Command: pip install -r requirements.txt
   Run Command: uvicorn app.main:app --host 0.0.0.0 --port 8080
   HTTP Port: 8080
   ```

   **Frontend Static Site**:
   ```
   Type: Static Site
   Source: frontend/
   Build Command: npm run build
   Output Directory: dist
   ```

5. **Environment Variables** (same as above)

6. **Launch** - DigitalOcean provides URLs

### ✅ Done! Production-ready deployment

---

## Option 4: Heroku (Classic Platform)

### Install Heroku CLI

```bash
brew install heroku/brew/heroku  # macOS
# or download from https://devcenter.heroku.com/articles/heroku-cli
```

### Deploy Backend

```bash
cd /tmp/claude/clinical-study-extraction-app/backend

# Login
heroku login

# Create app
heroku create clinical-study-backend

# Set buildpack
heroku buildpacks:set heroku/python

# Set environment variables
heroku config:set PORT=8000
heroku config:set CORS_ORIGINS=https://your-frontend.herokuapp.com

# Deploy
git init
git add .
git commit -m "Deploy backend"
git push heroku main

# Get URL
heroku open
```

### Deploy Frontend

```bash
cd ../frontend

# Create app
heroku create clinical-study-frontend

# Set buildpack
heroku buildpacks:set heroku/nodejs

# Set environment
heroku config:set VITE_API_BASE_URL=https://clinical-study-backend.herokuapp.com
heroku config:set VITE_GEMINI_API_KEY=AIzaSyDTIPrQLPSMr35Ag53LdV37EUK4lbjvroI

# Add Procfile
echo "web: npm run build && npm run serve" > Procfile

# Deploy
git init
git add .
git commit -m "Deploy frontend"
git push heroku main

# Get URL
heroku open
```

---

## Cost Comparison

| Platform | Backend | Frontend | Total/Month | Free Tier |
|----------|---------|----------|-------------|-----------|
| **Railway + Vercel** | Free/month | Free | **$0** | ✅ 500 hours |
| **Render** | $7 | Free | **$7** | ✅ 750 hours |
| **DigitalOcean** | $5 | $3 | **$8** | ❌ No |
| **Heroku** | $7 | $7 | **$14** | ❌ No |
| **AWS/Azure/GCP** | ~$10-20 | ~$5 | **$15-25** | ✅ Limited |

**Recommendation**: Start with **Railway + Vercel** (FREE) or **Render** ($7/month)

---

## Quick Commands Cheat Sheet

### Check Backend Health

```bash
# Local
curl http://localhost:8000/health

# Production
curl https://your-backend-url.com/health
```

**Expected response**:
```json
{"status": "healthy", "version": "1.0.0"}
```

### Test API Endpoints

```bash
# Get API docs
open https://your-backend-url.com/docs

# Test table extraction (with test PDF)
curl -X POST https://your-backend-url.com/api/extract-tables \
  -F "file=@test.pdf"
```

### View Logs

**Railway**: Click app → View Logs
**Render**: Click service → Logs tab
**Vercel**: Click deployment → Function Logs
**Heroku**: `heroku logs --tail -a your-app-name`

---

## Troubleshooting Deployment

### Backend won't start

**Check**:
1. All environment variables set correctly
2. PORT variable matches platform requirements
3. Requirements.txt includes all dependencies
4. Python version is 3.8+ (check platform settings)

**Solution**:
```bash
# View logs to see error
# Railway: Dashboard → Logs
# Render: Service → Logs
# Heroku: heroku logs --tail
```

### Frontend can't connect to backend

**Check**:
1. CORS_ORIGINS includes frontend URL (with https://)
2. VITE_API_BASE_URL points to backend URL
3. Backend is actually running (check /health endpoint)

**Solution**:
```bash
# Test backend directly
curl https://your-backend.com/health

# Check CORS
curl -H "Origin: https://your-frontend.com" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS \
     https://your-backend.com/api/extract-tables
```

### PDF extraction fails

**Check**:
1. File size under MAX_FILE_SIZE (50MB default)
2. PDF is not password-protected
3. Backend has enough memory (check platform limits)

### AI features not working

**Check**:
1. VITE_GEMINI_API_KEY is set correctly
2. API key is valid at https://aistudio.google.com/
3. Check browser console for errors (F12)

---

## Post-Deployment Checklist

### Backend
- [ ] `/health` endpoint returns 200 OK
- [ ] `/docs` shows API documentation
- [ ] Can upload and extract from test PDF
- [ ] CORS allows frontend domain

### Frontend
- [ ] Page loads without errors
- [ ] Can load a PDF
- [ ] "Quick Extract All" button works
- [ ] AI features respond (✨ buttons)
- [ ] Export functions work

### Security
- [ ] API keys not exposed in frontend source
- [ ] CORS limited to specific origins
- [ ] HTTPS enabled on both services
- [ ] File upload size limits enforced

---

## Next Steps After Deployment

1. **Test thoroughly** with real clinical study PDFs
2. **Monitor performance** using platform dashboards
3. **Set up custom domain** (optional)
4. **Enable monitoring** (Sentry, LogRocket)
5. **Add CI/CD** with GitHub Actions
6. **Scale if needed** (upgrade platform tier)

---

## Get Help

- **Issues**: https://github.com/matheus-rech/clinical-study-extraction-app/issues
- **Railway Docs**: https://docs.railway.app/
- **Vercel Docs**: https://vercel.com/docs
- **Render Docs**: https://render.com/docs

---

## 🎯 Recommended First Deployment

**For testing**: Railway (backend) + Vercel (frontend) - FREE
**For production**: Render ($7/month) - More reliable, better support

Both options take about 10 minutes total and require no credit card initially.

**Start here**: https://railway.app/ ✅
