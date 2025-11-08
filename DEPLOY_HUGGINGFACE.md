# 🤗 Deploy to Hugging Face Spaces - FREE!

Deploy the Clinical Study Extraction App to Hugging Face Spaces **completely free** with unlimited usage!

---

## 🎯 Why Hugging Face Spaces?

- ✅ **100% FREE** - No credit card required
- ✅ **50GB Storage** - Ephemeral (resets on restart)
- ✅ **16GB RAM** - Plenty for PDF processing
- ✅ **Public URL** - Instant access via `your-space.hf.space`
- ✅ **Auto-deploy** - Push to GitHub → Auto-updates
- ✅ **GPU Support** - Available with paid upgrades
- ✅ **No time limits** - Unlike some free tiers

---

## 🚀 Quick Deploy (5 Minutes)

### Step 1: Create Hugging Face Account (1 minute)

1. Go to https://huggingface.co/join
2. Sign up (free, no credit card)
3. Verify your email

### Step 2: Create a New Space (2 minutes)

1. Go to https://huggingface.co/new-space
2. Fill in:
   - **Space name**: `clinical-study-extraction` (or your choice)
   - **License**: MIT
   - **SDK**: Select **Docker** ⚠️ Important!
   - **Space hardware**: CPU basic (free)
   - **Visibility**: Public (or Private if you prefer)

3. Click **Create Space**

### Step 3: Connect Your GitHub Repository (1 minute)

**Option A: Direct Upload (Easiest)**

1. In your new Space, click **Files** tab
2. Click **Add file** → **Upload files**
3. Upload these files from your local repository:
   - `Dockerfile.huggingface` (rename to `Dockerfile`)
   - `README_HUGGINGFACE.md` (rename to `README.md`)
   - `backend/` directory (entire folder)
4. Click **Commit changes**

**Option B: Git Clone (Advanced)**

```bash
# Clone your Space repository
git clone https://huggingface.co/spaces/YOUR-USERNAME/clinical-study-extraction
cd clinical-study-extraction

# Copy files from your GitHub repo
cp -r /path/to/clinical-study-extraction-app/backend .
cp /path/to/clinical-study-extraction-app/Dockerfile.huggingface Dockerfile
cp /path/to/clinical-study-extraction-app/README_HUGGINGFACE.md README.md

# Commit and push
git add .
git commit -m "Initial deployment"
git push
```

### Step 4: Configure Secrets (1 minute)

1. In your Space, click **Settings** tab
2. Scroll to **Repository secrets**
3. Add secrets:

| Secret Name | Value | Required |
|-------------|-------|----------|
| `OLMOCR_API_KEY` | Your DeepInfra API key | Optional |
| `GEMINI_API_KEY` | Your Gemini API key | Optional |
| `ANTHROPIC_API_KEY` | Your Anthropic API key | Optional |

**Get olmOCR API Key:**
- Go to https://deepinfra.com
- Sign up (free tier available)
- Copy API key: `4g6DiFP5V2myP6skXuqUPZDquyRCJ9wf`

### Step 5: Wait for Build (2-3 minutes)

1. Go to **Logs** tab
2. Watch the build progress
3. Wait for "Running on http://0.0.0.0:7860"

### Step 6: Access Your App! 🎉

Your app is now live at:
```
https://YOUR-USERNAME-clinical-study-extraction.hf.space
```

**API Documentation:**
```
https://YOUR-USERNAME-clinical-study-extraction.hf.space/docs
```

---

## 📋 Complete Example

```bash
# 1. Create Space on Hugging Face
# Name: clinical-study-extraction
# SDK: Docker

# 2. Clone Space repository
git clone https://huggingface.co/spaces/YOUR-USERNAME/clinical-study-extraction
cd clinical-study-extraction

# 3. Copy application files
cp -r ~/clinical-study-extraction-app/backend .
cp ~/clinical-study-extraction-app/Dockerfile.huggingface Dockerfile
cp ~/clinical-study-extraction-app/README_HUGGINGFACE.md README.md

# 4. Commit and push
git add .
git commit -m "Deploy Clinical Study Extraction App"
git push

# 5. Add secrets in Space Settings
# OLMOCR_API_KEY=4g6DiFP5V2myP6skXuqUPZDquyRCJ9wf

# 6. Wait 2-3 minutes for build

# 7. Access your app!
# https://YOUR-USERNAME-clinical-study-extraction.hf.space/docs
```

---

## 🔧 File Structure

Your Space should have this structure:

```
clinical-study-extraction/
├── Dockerfile              # From Dockerfile.huggingface
├── README.md               # From README_HUGGINGFACE.md
└── backend/
    ├── app/
    │   ├── main.py
    │   ├── api/
    │   └── core/
    ├── requirements.txt
    └── alembic/
```

---

## 📝 Dockerfile Modifications

The `Dockerfile.huggingface` is optimized for Hugging Face Spaces:

### Key Differences from Standard Dockerfile

1. **User ID 1000** (required by HF Spaces)
   ```dockerfile
   RUN useradd -m -u 1000 user
   USER user
   ```

2. **Port 7860** (HF Spaces default)
   ```dockerfile
   ENV PORT=7860
   EXPOSE 7860
   ```

3. **No Database** (free tier uses ephemeral storage)
   - Removed PostgreSQL dependency
   - Removed Redis dependency
   - Simplified configuration

4. **Single Worker** (optimized for free tier)
   ```dockerfile
   CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860", "--workers", "1"]
   ```

---

## 🎯 Testing Your Deployment

### Health Check

```bash
curl https://YOUR-USERNAME-clinical-study-extraction.hf.space/health
```

Expected response:
```json
{"status":"healthy","service":"PDF Processing API"}
```

### Extract Tables

```bash
curl -X POST "https://YOUR-USERNAME-clinical-study-extraction.hf.space/api/extract-tables-unified" \
  -F "file=@your_study.pdf" \
  -F "page_num=4"
```

### View API Documentation

Open in browser:
```
https://YOUR-USERNAME-clinical-study-extraction.hf.space/docs
```

---

## 🔄 Auto-Deploy from GitHub

### Option 1: GitHub Actions (Recommended)

1. Create `.github/workflows/deploy-huggingface.yml`:

```yaml
name: Deploy to Hugging Face Spaces

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Push to Hugging Face Space
        env:
          HF_TOKEN: ${{ secrets.HF_TOKEN }}
        run: |
          git clone https://huggingface.co/spaces/${{ secrets.HF_USERNAME }}/clinical-study-extraction hf-space
          cp -r backend hf-space/
          cp Dockerfile.huggingface hf-space/Dockerfile
          cp README_HUGGINGFACE.md hf-space/README.md
          cd hf-space
          git config user.name "GitHub Actions"
          git config user.email "actions@github.com"
          git add .
          git commit -m "Auto-deploy from GitHub"
          git push https://USER:$HF_TOKEN@huggingface.co/spaces/${{ secrets.HF_USERNAME }}/clinical-study-extraction
```

2. Add GitHub Secrets:
   - `HF_TOKEN`: Your Hugging Face token (from https://huggingface.co/settings/tokens)
   - `HF_USERNAME`: Your Hugging Face username

### Option 2: Manual Sync

```bash
# In your local repository
./sync-to-huggingface.sh
```

Create `sync-to-huggingface.sh`:
```bash
#!/bin/bash
HF_SPACE="https://huggingface.co/spaces/YOUR-USERNAME/clinical-study-extraction"

git clone $HF_SPACE hf-temp
cp -r backend hf-temp/
cp Dockerfile.huggingface hf-temp/Dockerfile
cp README_HUGGINGFACE.md hf-temp/README.md
cd hf-temp
git add .
git commit -m "Update from GitHub"
git push
cd ..
rm -rf hf-temp
```

---

## 💡 Optimization Tips

### For Free Tier

1. **Use Single Worker**
   - Free tier has limited CPU
   - 1 worker is sufficient for most use cases

2. **Optimize Dependencies**
   - Only install required packages
   - Use slim base images

3. **Cache Aggressively**
   - Cache extraction results
   - Reuse processed data

4. **Limit File Sizes**
   - Max 100MB per upload
   - Process pages individually for large PDFs

### For Better Performance

1. **Upgrade to Persistent Storage** ($5/month)
   - 20GB persistent disk
   - Faster restarts
   - Cache survives restarts

2. **Upgrade to GPU** ($0.60/hour)
   - Faster olmOCR processing
   - Better for high-volume usage

---

## 🆘 Troubleshooting

### Build Fails

**Error: "Permission denied"**
```dockerfile
# Make sure all COPY commands use --chown=user
COPY --chown=user backend/app $HOME/app/app
```

**Error: "Port 7860 already in use"**
- Hugging Face Spaces requires port 7860
- Don't change the port in your Dockerfile

### Runtime Issues

**Error: "Out of memory"**
- Reduce image DPI in extraction settings
- Process fewer pages at once
- Consider upgrading to larger instance

**Error: "olmOCR not working"**
- Check if `OLMOCR_API_KEY` is set in Secrets
- Verify API key at https://deepinfra.com
- Check logs for error messages

### Slow Performance

**Solution 1: Optimize extraction**
```python
# Extract specific pages only
extract_tables(pdf_path, page_num=4)  # Not all pages
```

**Solution 2: Disable olmOCR fallback**
```
# In Space Settings, set:
OLMOCR_ENABLED=false
```

**Solution 3: Upgrade hardware**
- Go to Space Settings → Hardware
- Upgrade to CPU upgrade ($0.03/hour) or GPU

---

## 📊 Comparison: Free Hosting Options

| Provider | Cost | Storage | RAM | Timeout | Best For |
|----------|------|---------|-----|---------|----------|
| **Hugging Face** | Free | 50GB | 16GB | None | ⭐ Production |
| Railway | $0-10 | 1GB | 512MB | 30min | Development |
| Render | $0-7 | 512MB | 512MB | 15min | Small apps |
| DigitalOcean | $6 | 50GB | 2GB | None | Full control |

**Winner: Hugging Face Spaces** for free production deployment! 🏆

---

## ✅ Deployment Checklist

- [ ] Created Hugging Face account
- [ ] Created new Space with Docker SDK
- [ ] Uploaded Dockerfile (from Dockerfile.huggingface)
- [ ] Uploaded README.md (from README_HUGGINGFACE.md)
- [ ] Uploaded backend/ directory
- [ ] Added OLMOCR_API_KEY to Secrets (optional)
- [ ] Waited for build to complete
- [ ] Tested health endpoint
- [ ] Tested table extraction
- [ ] Viewed API documentation

---

## 🎊 Success!

Your app is now deployed and accessible at:
```
https://YOUR-USERNAME-clinical-study-extraction.hf.space
```

**Next Steps:**
1. Share your Space URL with users
2. Monitor usage in Space Analytics
3. Consider upgrading for better performance
4. Set up auto-deploy from GitHub

---

## 📚 Additional Resources

- **Hugging Face Spaces Docs**: https://huggingface.co/docs/hub/spaces
- **Docker Spaces Guide**: https://huggingface.co/docs/hub/spaces-sdks-docker
- **Pricing**: https://huggingface.co/pricing
- **Community**: https://discuss.huggingface.co/

---

**Congratulations! You're now running a production PDF extraction API for FREE!** 🎉
