# GitHub Actions Workflows Documentation

This directory contains automated deployment workflows for the Clinical Study Extraction App. Choose the workflow that matches your deployment strategy.

## 📋 Available Workflows

| Workflow | File | Purpose | Best For |
|----------|------|---------|----------|
| **CI/CD** | `ci.yml` | Testing & linting | All branches |
| **VPS Deployment** | `deploy-vps.yml` | Docker Compose on VPS | Production, self-hosted |
| **Railway Full** | `deploy-railway.yml` | Full stack to Railway | Quick deployment |
| **Split Deployment** | `deploy-split.yml` | Frontend (Vercel) + Backend (Railway) | Scalability, free tiers |

---

## 🔧 Workflow 1: CI/CD Testing (ci.yml)

**Triggers:** Push to `main`, `develop`, `claude/**` branches, or pull requests

**What it does:**
- ✅ Runs backend Python tests with pytest
- ✅ Lints Python code with flake8
- ✅ Builds frontend with Vite
- ✅ Tests Docker builds
- ✅ Uploads coverage reports to Codecov

**No setup required** - runs automatically on every push/PR.

**Optional:** Add Codecov integration:
```bash
# For private repositories or more reliable uploads, add CODECOV_TOKEN to repository secrets
# For public repositories, the token is not required
# Get token from: https://codecov.io/
```

---

## 🚀 Workflow 2: VPS Deployment (deploy-vps.yml)

**Best for:** DigitalOcean, Linode, AWS EC2, or any Linux VPS

### Prerequisites

1. **VPS Server Setup:**
   ```bash
   # SSH into your VPS
   ssh root@your-vps-ip

   # Install Docker
   curl -fsSL https://get.docker.com -o get-docker.sh
   sh get-docker.sh

   # Install Docker Compose
   apt-get install docker-compose-plugin

   # Create deployment directory
   mkdir -p /opt/clinical-study-app
   ```

2. **SSH Key Setup:**
   ```bash
   # Generate SSH key (on your local machine)
   ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/github_actions

   # Copy public key to VPS
   ssh-copy-id -i ~/.ssh/github_actions.pub user@your-vps-ip

   # Copy private key content for GitHub secret
   cat ~/.ssh/github_actions
   ```

### GitHub Secrets Configuration

Go to: `Settings` → `Secrets and variables` → `Actions` → `New repository secret`

**Required Secrets:**

| Secret Name | Description | Example |
|------------|-------------|---------|
| `SSH_PRIVATE_KEY` | SSH private key content | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `VPS_HOST` | VPS IP address or hostname | `123.45.67.89` or `app.example.com` |
| `VPS_USER` | SSH user | `root` or `ubuntu` |
| `DEPLOY_PATH` | Deployment directory | `/opt/clinical-study-app` |
| `APP_URL` | Your app's public URL | `https://app.example.com` |
| `SECRET_KEY` | Django/FastAPI secret key | Generate: `openssl rand -hex 32` |
| `CORS_ORIGINS` | Allowed frontend origins | `https://app.example.com,https://www.example.com` |
| `ENTREZ_EMAIL` | Email for PubMed API | `your-email@example.com` |
| `GEMINI_API_KEY` | Google Gemini API key | `AIza...` (optional) |
| `VITE_API_BASE_URL` | Backend URL for frontend | `https://api.example.com` or `https://app.example.com:8000` |

### Usage

**Automatic deployment:**
```bash
# Deploy automatically when pushing to main
git push origin main
```

**Manual deployment:**
1. Go to `Actions` tab in GitHub
2. Select "Deploy to VPS (Docker Compose)"
3. Click "Run workflow"
4. Choose environment (production/staging)
5. Click "Run workflow"

### Post-Deployment

**Set up reverse proxy (optional but recommended):**

Using Caddy (automatic HTTPS):
```bash
# Install Caddy on VPS
apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install caddy

# Create Caddyfile
cat > /etc/caddy/Caddyfile << 'EOF'
app.example.com {
    reverse_proxy localhost:80
}

api.example.com {
    reverse_proxy localhost:8000
}
EOF

# Restart Caddy
systemctl restart caddy
```

---

## 🚂 Workflow 3: Railway Full Stack (deploy-railway.yml)

**Best for:** Quick deployment with minimal configuration

### Prerequisites

1. **Create Railway Account:** https://railway.app/
2. **Create New Project:** Click "New Project" → "Empty Project"
3. **Add Services:**
   - Click "New" → "Empty Service" → Name it "backend"
   - Click "New" → "Empty Service" → Name it "frontend"

### GitHub Secrets Configuration

| Secret Name | Description | How to Get |
|------------|-------------|------------|
| `RAILWAY_TOKEN` | Railway API token | Railway Dashboard → Account Settings → Tokens → Create |
| `RAILWAY_PROJECT_ID` | Project ID | Railway Project → Settings → Copy ID |
| `RAILWAY_BACKEND_URL` | Backend service URL | Railway backend service → Settings → Domains → Generated domain |
| `RAILWAY_FRONTEND_URL` | Frontend service URL | Railway frontend service → Settings → Domains → Generated domain |
| `SECRET_KEY` | Application secret key | `openssl rand -hex 32` |
| `CORS_ORIGINS` | Allowed origins | Use your Railway frontend URL |
| `ENTREZ_EMAIL` | Email for PubMed | `your-email@example.com` |
| `GEMINI_API_KEY` | Gemini API key | Optional |

### Railway Service Configuration

**Backend Service:**
1. Go to backend service → Settings
2. Build settings:
   - Root Directory: `/backend`
   - Dockerfile Path: `Dockerfile`
3. Deploy settings:
   - Start Command: (leave empty, uses Dockerfile CMD)

**Frontend Service:**
1. Go to frontend service → Settings
2. Build settings:
   - Root Directory: `/frontend`
   - Dockerfile Path: `Dockerfile`
3. Deploy settings:
   - Start Command: (leave empty, uses Dockerfile CMD)

### Usage

```bash
# Automatic on push to main
git push origin main

# Or manual via GitHub Actions tab
```

**Cost:** ~$10-20/month for both services (after $5 free credit)

---

## 🎯 Workflow 4: Split Deployment (deploy-split.yml)

**Best for:** Cost optimization, leveraging free tiers

**Architecture:**
- Frontend → Vercel (Free tier, unlimited bandwidth)
- Backend → Railway ($5 free credit/month)

### Prerequisites

#### 1. Vercel Setup

```bash
# Install Vercel CLI
npm install -g vercel

# Login and link project
cd frontend
vercel login
vercel link

# Note the project and org IDs (shown after linking)
```

#### 2. Railway Setup

Same as Workflow 3, but only create the backend service.

### GitHub Secrets Configuration

**Vercel Secrets:**

| Secret Name | Description | How to Get |
|------------|-------------|------------|
| `VERCEL_TOKEN` | Vercel API token | Vercel Dashboard → Settings → Tokens → Create |
| `VERCEL_ORG_ID` | Organization ID | Run `vercel link` and check `.vercel/project.json` |
| `VERCEL_PROJECT_ID` | Project ID | Run `vercel link` and check `.vercel/project.json` |

**Railway Secrets:**

| Secret Name | Description |
|------------|-------------|
| `RAILWAY_TOKEN` | Railway API token |
| `RAILWAY_PROJECT_ID` | Backend service project ID |
| `RAILWAY_BACKEND_URL` | Backend service URL |

**Application Secrets:**

| Secret Name | Description |
|------------|-------------|
| `SECRET_KEY` | Application secret |
| `CORS_ORIGINS` | Include your Vercel domain |
| `ENTREZ_EMAIL` | PubMed API email |
| `GEMINI_API_KEY` | Optional |

### Important: CORS Configuration

After first deployment, update Railway backend CORS settings:

1. Go to Railway → Backend Service → Variables
2. Update `CORS_ORIGINS` to include your Vercel URL:
   ```
   https://your-app.vercel.app,https://your-app-*.vercel.app
   ```

### Usage

```bash
# Push to main branch
git push origin main

# Workflow will:
# 1. Deploy backend to Railway
# 2. Wait for backend to be healthy
# 3. Deploy frontend to Vercel with backend URL
# 4. Verify both deployments
```

**Cost:** $0-5/month (Vercel free + Railway free credit)

---

## 🔐 Security Best Practices

### 1. Rotate Secrets Regularly

```bash
# Generate new secret key every 90 days
openssl rand -hex 32
```

### 2. Use Environment-Specific Secrets

Create separate secrets for staging/production:
- `PROD_SECRET_KEY` vs `STAGING_SECRET_KEY`
- Configure in workflow: `${{ secrets[format('{0}_SECRET_KEY', env.ENVIRONMENT)] }}`

### 3. Limit SSH Key Permissions

```bash
# Create deployment-specific user on VPS
adduser deployer
usermod -aG docker deployer

# Use 'deployer' instead of 'root' for VPS_USER
```

### 4. Enable GitHub Environment Protection

1. Go to `Settings` → `Environments`
2. Create `production` environment
3. Add protection rules:
   - ✅ Required reviewers
   - ✅ Wait timer
   - ✅ Deployment branches (main only)

---

## 📊 Monitoring & Debugging

### Check Workflow Logs

1. Go to `Actions` tab
2. Click on the workflow run
3. Expand job to see detailed logs

### SSH into VPS for Debugging

```bash
ssh $VPS_USER@$VPS_HOST
cd $DEPLOY_PATH

# Check container status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f backend
docker-compose -f docker-compose.prod.yml logs -f frontend

# Restart services
docker-compose -f docker-compose.prod.yml restart
```

### Railway Debugging

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# View logs
railway logs --service backend
railway logs --service frontend
```

### Vercel Debugging

```bash
# View deployment logs
vercel logs [deployment-url]

# List deployments
vercel ls
```

---

## 🎨 Customization

### Add Slack Notifications

Add to any workflow (before last step):

```yaml
- name: Notify Slack
  if: always()
  uses: slackapi/slack-github-action@v1
  with:
    webhook-url: ${{ secrets.SLACK_WEBHOOK_URL }}
    payload: |
      {
        "text": "Deployment ${{ job.status }}: ${{ github.repository }}@${{ github.ref_name }}"
      }
```

### Add Discord Notifications

```yaml
- name: Notify Discord
  if: always()
  uses: sarisia/actions-status-discord@v1
  with:
    webhook: ${{ secrets.DISCORD_WEBHOOK }}
    status: ${{ job.status }}
    title: "Deployment Complete"
```

### Run Migrations After Deploy

Add to VPS workflow after deployment:

```yaml
- name: Run Database Migrations
  run: |
    ssh ${{ secrets.VPS_USER }}@${{ secrets.VPS_HOST }} << 'ENDSSH'
      cd ${{ secrets.DEPLOY_PATH }}
      docker-compose -f docker-compose.prod.yml exec -T backend python manage.py migrate
    ENDSSH
```

---

## 🆘 Troubleshooting

### Issue: SSH Connection Failed

**Solution:**
```bash
# Verify SSH key format
cat ~/.ssh/github_actions | head -1
# Should show: -----BEGIN OPENSSH PRIVATE KEY-----

# Test SSH connection
ssh -i ~/.ssh/github_actions $VPS_USER@$VPS_HOST

# Check VPS firewall
ufw status
ufw allow 22/tcp  # Enable SSH if blocked
```

### Issue: Docker Build Failed

**Solution:**
```bash
# Check Docker logs on VPS
ssh $VPS_USER@$VPS_HOST
docker-compose -f docker-compose.prod.yml logs --tail=100

# Manually rebuild
docker-compose -f docker-compose.prod.yml build --no-cache
```

### Issue: Railway Deployment Timeout

**Solution:**
- Increase timeout in Railway settings (Settings → Deploy → Timeout)
- Check Railway logs for specific errors
- Verify Dockerfile builds locally: `docker build -t test ./backend`

### Issue: Vercel Build Failed

**Solution:**
```bash
# Test build locally
cd frontend
npm install
npm run build

# Check environment variables in Vercel dashboard
# Ensure VITE_API_BASE_URL is set correctly
```

### Issue: CORS Errors After Deployment

**Solution:**
1. Update backend `CORS_ORIGINS` to include:
   ```
   https://your-frontend-domain.com
   https://www.your-frontend-domain.com
   ```
2. Restart backend service
3. Clear browser cache and test

---

## 📚 Additional Resources

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Railway Documentation](https://docs.railway.app/)
- [Vercel Documentation](https://vercel.com/docs)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Digital Ocean App Platform](https://docs.digitalocean.com/products/app-platform/)

---

## 🤝 Contributing

To add new workflows:

1. Create new `.yml` file in `.github/workflows/`
2. Test locally using [act](https://github.com/nektos/act)
3. Document in this README
4. Submit pull request

---

**Need help?** Open an issue in the repository with the `deployment` label.
