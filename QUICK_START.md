# ⚡ Quick Start - Deploy in 3 Minutes

## 🚀 One-Click Deployment (Recommended)

### Step 1: Create DigitalOcean Droplet
- Go to [DigitalOcean](https://digitalocean.com)
- Create Droplet: Ubuntu 22.04, $6/month plan
- Note your IP address

### Step 2: SSH and Run Setup
```bash
ssh root@YOUR_DROPLET_IP
curl -fsSL https://raw.githubusercontent.com/matheus-rech/clinical-study-extraction-app/main/setup.sh | bash
```

### Step 3: Enter Your API Key
When prompted:
```
olmOCR API Key: 4g6DiFP5V2myP6skXuqUPZDquyRCJ9wf
```
Press Enter for all other prompts.

### Step 4: Access Your App
- **Backend**: `http://YOUR_DROPLET_IP:8000`
- **API Docs**: `http://YOUR_DROPLET_IP:8000/docs`
- **Frontend**: `http://YOUR_DROPLET_IP:3000`

**Done!** 🎉

---

## 💻 Local Development

### Prerequisites
- Docker and Docker Compose installed

### Steps

```bash
# 1. Clone repository
git clone https://github.com/matheus-rech/clinical-study-extraction-app.git
cd clinical-study-extraction-app

# 2. Configure environment
cp .env.example .env
nano .env  # Add olmOCR API key

# 3. Start services
chmod +x deploy-docker.sh
./deploy-docker.sh up

# 4. Access
# Frontend: http://localhost:3000
# Backend:  http://localhost:8000
# API Docs: http://localhost:8000/docs
```

---

## 🛠️ Management Commands

```bash
cd /opt/clinical-study-extraction-app

./deploy-docker.sh status    # Check status
./deploy-docker.sh logs      # View logs
./deploy-docker.sh restart   # Restart services
./deploy-docker.sh backup    # Backup database
./deploy-docker.sh health    # Health check
```

---

## 🔑 API Keys

### Required
- **olmOCR API Key**: `4g6DiFP5V2myP6skXuqUPZDquyRCJ9wf`
  - Get from: https://deepinfra.com

### Optional
- **Gemini API Key**: (press Enter to skip)
- **Anthropic API Key**: (press Enter to skip)

---

## ✅ Verify Installation

```bash
# Check health
curl http://YOUR_DROPLET_IP:8000/health

# Should return:
# {"status":"healthy","service":"PDF Processing API"}
```

---

## 📚 Full Documentation

- **One-Click Guide**: `ONE_CLICK_DEPLOYMENT.md`
- **Docker Guide**: `DOCKER_DEPLOYMENT.md`
- **Features**: `FINAL_DELIVERY_SUMMARY.md`

---

## 🆘 Troubleshooting

### Can't access application?
```bash
# Check services
cd /opt/clinical-study-extraction-app
./deploy-docker.sh status

# Check firewall
sudo ufw status
```

### Services not starting?
```bash
# View logs
./deploy-docker.sh logs

# Restart
./deploy-docker.sh restart
```

### Port already in use?
```bash
# Find process
lsof -ti:8000

# Kill process
kill $(lsof -ti:8000)
```

---

## 🎯 Complete Example

```bash
# 1. SSH into droplet
ssh root@142.93.123.45

# 2. Run one-click setup
curl -fsSL https://raw.githubusercontent.com/matheus-rech/clinical-study-extraction-app/main/setup.sh | bash

# 3. Enter API key when prompted
# olmOCR API Key: 4g6DiFP5V2myP6skXuqUPZDquyRCJ9wf

# 4. Wait 2-3 minutes...

# 5. Access application
# http://142.93.123.45:8000/docs
```

**Total time: ~3 minutes** ⏱️

---

## 📊 What Gets Deployed?

- ✅ Backend (FastAPI with 4 workers)
- ✅ Frontend (React)
- ✅ PostgreSQL (Database with schema)
- ✅ Redis (Cache)
- ✅ Nginx (Reverse proxy)
- ✅ 4 Extraction Methods (PyMuPDF, Camelot, Tabula, olmOCR)
- ✅ 5 Export Formats (CSV, Excel, JSON, HTML, PDF)

---

## 🔄 GitHub Actions Auto-Deploy

For automated deployments, see: `ONE_CLICK_DEPLOYMENT.md`

---

**Ready to deploy? Just run the one-click command!** 🚀

```bash
curl -fsSL https://raw.githubusercontent.com/matheus-rech/clinical-study-extraction-app/main/setup.sh | bash
```
