# 🚀 One-Click Deployment Guide

Deploy the Clinical Study Extraction App **without needing a local machine** - everything runs directly on your server!

---

## 🎯 Two Deployment Options

### **Option 1: One-Click Setup Script** ⭐ (Recommended)
Run a single command on your DigitalOcean droplet - everything is automated!

### **Option 2: GitHub Actions Auto-Deploy**
Push to GitHub and it automatically deploys to your server!

---

## 📦 Option 1: One-Click Setup Script

### Prerequisites
- ✅ A DigitalOcean Droplet (or any Ubuntu/Debian server)
- ✅ SSH access to your server
- ✅ olmOCR API key from DeepInfra

### Step 1: Create DigitalOcean Droplet

1. Go to [DigitalOcean](https://www.digitalocean.com)
2. Click "Create" → "Droplets"
3. Choose:
   - **Image**: Ubuntu 22.04 LTS
   - **Plan**: Basic ($6/month)
   - **CPU**: Regular (2GB RAM / 1 CPU)
   - **Region**: Closest to you
   - **Authentication**: SSH Key (recommended) or Password
4. Click "Create Droplet"
5. Wait ~60 seconds for droplet to be ready
6. Note your droplet's IP address

### Step 2: SSH into Your Droplet

```bash
ssh root@your-droplet-ip
```

### Step 3: Run One-Click Setup

**Copy and paste this single command:**

```bash
curl -fsSL https://raw.githubusercontent.com/matheus-rech/clinical-study-extraction-app/main/setup.sh | bash
```

**Or using wget:**

```bash
wget -qO- https://raw.githubusercontent.com/matheus-rech/clinical-study-extraction-app/main/setup.sh | bash
```

### Step 4: Follow the Prompts

The script will ask you for:

1. **olmOCR API Key** (Required)
   - Get from: https://deepinfra.com
   - Example: `4g6DiFP5V2myP6skXuqUPZDquyRCJ9wf`

2. **PostgreSQL Password** (Optional - auto-generated if skipped)
   - Press Enter to auto-generate

3. **Gemini API Key** (Optional)
   - Press Enter to skip

4. **Anthropic API Key** (Optional)
   - Press Enter to skip

5. **CORS Origins** (Optional)
   - Press Enter for default (`*`)

### Step 5: Done! 🎉

The script will:
- ✅ Install Docker and dependencies
- ✅ Clone the repository
- ✅ Configure environment
- ✅ Deploy all services
- ✅ Set up firewall
- ✅ Start the application

**Access your application:**
- Backend API: `http://your-droplet-ip:8000`
- API Docs: `http://your-droplet-ip:8000/docs`
- Frontend: `http://your-droplet-ip:3000`

---

## ⚡ Quick Example

```bash
# 1. SSH into droplet
ssh root@142.93.123.45

# 2. Run setup script
curl -fsSL https://raw.githubusercontent.com/matheus-rech/clinical-study-extraction-app/main/setup.sh | bash

# 3. Enter your olmOCR API key when prompted
# olmOCR API Key: 4g6DiFP5V2myP6skXuqUPZDquyRCJ9wf

# 4. Press Enter for other prompts (use defaults)

# 5. Wait 2-3 minutes...

# 6. Access: http://142.93.123.45:8000/docs
```

**Total time: ~3 minutes** ⏱️

---

## 🔄 Option 2: GitHub Actions Auto-Deploy

### Prerequisites
- ✅ GitHub account
- ✅ DigitalOcean Droplet (already set up with setup.sh)
- ✅ SSH key for GitHub Actions

### Step 1: Generate SSH Key for GitHub Actions

On your **local machine** or **droplet**:

```bash
# Generate SSH key
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/github_actions_key -N ""

# Copy public key to droplet
ssh-copy-id -i ~/.ssh/github_actions_key.pub root@your-droplet-ip

# Display private key (copy this for GitHub)
cat ~/.ssh/github_actions_key
```

### Step 2: Add GitHub Secrets

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**

Add these secrets:

| Secret Name | Value | Example |
|-------------|-------|---------|
| `DO_HOST` | Your droplet IP | `142.93.123.45` |
| `DO_USER` | SSH username | `root` |
| `DO_SSH_KEY` | Private SSH key | Contents of `github_actions_key` |
| `DO_DEPLOY_PATH` | Installation path | `/opt/clinical-study-extraction-app` |
| `OLMOCR_API_KEY` | olmOCR API key | `4g6DiFP5V2myP6skXuqUPZDquyRCJ9wf` |
| `POSTGRES_PASSWORD` | Database password | From your `.env` file |

**Optional secrets:**
- `GEMINI_API_KEY`
- `ANTHROPIC_API_KEY`
- `SLACK_WEBHOOK` (for notifications)

### Step 3: Add Workflow File

1. Go to your GitHub repository
2. Click **Actions** → **New workflow** → **set up a workflow yourself**
3. Copy content from `.github/workflows/deploy-digitalocean.yml`
4. Commit directly to `main` branch

### Step 4: Deploy!

**Automatic deployment:**
- Push to `main` branch → Deploys to production
- Push to `develop` branch → Deploys to staging

**Manual deployment:**
1. Go to **Actions** tab
2. Click **Deploy to DigitalOcean**
3. Click **Run workflow**
4. Select branch and click **Run**

---

## 🛠️ Management Commands

After deployment, manage your application:

```bash
# SSH into your droplet
ssh root@your-droplet-ip

# Navigate to installation directory
cd /opt/clinical-study-extraction-app

# Check status
./deploy-docker.sh status

# View logs
./deploy-docker.sh logs
./deploy-docker.sh logs backend

# Restart services
./deploy-docker.sh restart

# Backup database
./deploy-docker.sh backup

# Update application
./deploy-docker.sh update

# Health check
./deploy-docker.sh health
```

---

## 📊 What Gets Installed?

The setup script installs and configures:

1. **Docker & Docker Compose** - Container runtime
2. **Git** - Version control
3. **UFW Firewall** - Security (ports 22, 80, 443, 8000, 3000)
4. **Fail2ban** - Intrusion prevention
5. **Application Stack**:
   - Backend (FastAPI)
   - Frontend (React)
   - PostgreSQL (Database)
   - Redis (Cache)
   - Nginx (Reverse proxy)

---

## 🔒 Security Features

The setup script automatically:
- ✅ Configures firewall (UFW)
- ✅ Enables fail2ban
- ✅ Sets up automatic security updates
- ✅ Uses secure passwords
- ✅ Restricts file permissions

---

## 🎯 Comparison

| Feature | One-Click Script | GitHub Actions |
|---------|------------------|----------------|
| **Setup Time** | 3 minutes | 10 minutes |
| **Complexity** | Very Easy | Medium |
| **Auto-Deploy** | No | Yes |
| **Best For** | Quick start | CI/CD pipeline |
| **Local Machine** | Not needed | Not needed |

---

## 💡 Recommended Workflow

1. **Initial Setup**: Use **One-Click Script** (3 minutes)
2. **Development**: Use **GitHub Actions** for auto-deploy
3. **Management**: Use `deploy-docker.sh` commands

---

## 🆘 Troubleshooting

### Script fails to download
```bash
# Try wget instead
wget -qO- https://raw.githubusercontent.com/matheus-rech/clinical-study-extraction-app/main/setup.sh | bash
```

### Docker permission denied
```bash
# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker
```

### Services not starting
```bash
# Check logs
cd /opt/clinical-study-extraction-app
./deploy-docker.sh logs

# Restart services
./deploy-docker.sh restart
```

### Can't access application
```bash
# Check firewall
sudo ufw status

# Open ports if needed
sudo ufw allow 8000/tcp
sudo ufw allow 3000/tcp
```

---

## 📚 Additional Resources

- **Full Documentation**: `DOCKER_DEPLOYMENT.md`
- **Feature Overview**: `FINAL_DELIVERY_SUMMARY.md`
- **API Documentation**: `http://your-ip:8000/docs`

---

## 🎊 Success Checklist

After running the setup script, verify:

- [ ] Backend API responds: `curl http://your-ip:8000/health`
- [ ] API docs accessible: `http://your-ip:8000/docs`
- [ ] Frontend loads: `http://your-ip:3000`
- [ ] Can upload PDF and extract tables
- [ ] Export functions work (CSV, Excel, PDF)

---

## 🚀 Next Steps

1. **Test the application** - Upload a PDF and extract tables
2. **Configure domain** (optional) - Point your domain to the droplet IP
3. **Enable SSL** (optional) - Follow `DOCKER_DEPLOYMENT.md` for SSL setup
4. **Set up GitHub Actions** - For automated deployments
5. **Monitor usage** - Check `./deploy-docker.sh logs`

---

## 📞 Support

If you encounter issues:
1. Check logs: `./deploy-docker.sh logs`
2. Review documentation: `DOCKER_DEPLOYMENT.md`
3. Open GitHub issue: https://github.com/matheus-rech/clinical-study-extraction-app/issues

---

**Ready to deploy?** Just run the one-click command! 🎉

```bash
curl -fsSL https://raw.githubusercontent.com/matheus-rech/clinical-study-extraction-app/main/setup.sh | bash
```
