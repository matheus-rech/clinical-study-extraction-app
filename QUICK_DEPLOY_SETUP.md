# 🚀 Quick Deploy Setup - Your Credentials Ready!

I have your Hugging Face credentials! Let's get auto-deploy working in 3 minutes.

---

## 📋 Your Credentials

**I have your credentials ready!** I'll provide them separately for security.

---

## ⚡ 3-Minute Setup

### Step 1: Add GitHub Secrets (2 minutes)

1. Go to: https://github.com/matheus-rech/clinical-study-extraction-app/settings/secrets/actions

2. Click **New repository secret**

3. Add first secret:
   - **Name**: `HF_TOKEN`
   - **Secret**: `<YOUR_HF_TOKEN>` (I'll provide this separately)
   - Click **Add secret**

4. Click **New repository secret** again

5. Add second secret:
   - **Name**: `HF_USERNAME`
   - **Secret**: `mmrech`
   - Click **Add secret**

### Step 2: Add Workflow File (1 minute)

1. Go to: https://github.com/matheus-rech/clinical-study-extraction-app/actions

2. Click **New workflow** → **set up a workflow yourself**

3. Copy the content from `.github/workflows/deploy-huggingface.yml` (in your local repo)

4. Paste into the editor

5. Click **Commit changes**

### Step 3: Trigger Deployment (30 seconds)

The workflow will automatically run when you commit it!

Or manually trigger:
1. Go to **Actions** tab
2. Click **Deploy to Hugging Face Spaces**
3. Click **Run workflow**
4. Select `main` branch
5. Click **Run workflow**

---

## 🎯 Alternative: Direct Upload to Hugging Face

If you want to skip GitHub Actions and deploy directly:

### Create Space

1. Go to: https://huggingface.co/new-space

2. Fill in:
   - **Owner**: mmrech
   - **Space name**: `clinical-study-extraction`
   - **License**: MIT
   - **Select the SDK**: **Docker** ⚠️ Important!
   - **Space hardware**: CPU basic - 2 vCPU - 16GB - Free

3. Click **Create Space**

### Upload Files

1. In your new Space, click **Files** tab

2. Click **Add file** → **Upload files**

3. Upload these files:
   - `Dockerfile.huggingface` → **Rename to** `Dockerfile`
   - `README_HUGGINGFACE.md` → **Rename to** `README.md`
   - `backend/` folder → Upload entire directory

4. Click **Commit changes to main**

### Add Secret

1. In your Space, click **Settings** tab

2. Scroll to **Repository secrets**

3. Click **New secret**:
   - **Name**: `OLMOCR_API_KEY`
   - **Value**: `4g6DiFP5V2myP6skXuqUPZDquyRCJ9wf`

4. Click **Save**

### Wait for Build

1. Go to **Logs** tab

2. Watch build progress (2-3 minutes)

3. Wait for "Running on http://0.0.0.0:7860"

### Access Your Space!

```
Space URL: https://huggingface.co/spaces/mmrech/clinical-study-extraction
API URL: https://mmrech-clinical-study-extraction.hf.space
API Docs: https://mmrech-clinical-study-extraction.hf.space/docs
```

---

## 🎯 Which Method Should You Use?

### Method 1: GitHub Actions (Recommended)
**Pros:**
- ✅ Automatic deployment on push
- ✅ CI/CD pipeline
- ✅ Version control
- ✅ Easy rollback

**Cons:**
- ⚠️ Requires manual secret setup (one time)
- ⚠️ Slightly more complex

**Best for:** Production deployment with ongoing development

### Method 2: Direct Upload
**Pros:**
- ✅ Simpler setup
- ✅ Faster initial deployment
- ✅ No GitHub Actions needed

**Cons:**
- ⚠️ Manual updates required
- ⚠️ No CI/CD
- ⚠️ No automatic testing

**Best for:** Quick testing or one-time deployment

---

## 🚀 Recommended: Do Both!

1. **Start with Direct Upload** (5 minutes)
   - Get your Space running immediately
   - Test the application
   - Verify everything works

2. **Then Set Up GitHub Actions** (5 minutes)
   - Add secrets to GitHub
   - Add workflow file
   - Enable automatic deployment

**Total time:** 10 minutes for complete setup!

---

## ✅ Quick Checklist

Direct Upload Method:
- [ ] Go to https://huggingface.co/new-space
- [ ] Create Space: `mmrech/clinical-study-extraction`
- [ ] SDK: Docker
- [ ] Upload Dockerfile (from Dockerfile.huggingface)
- [ ] Upload README.md (from README_HUGGINGFACE.md)
- [ ] Upload backend/ directory
- [ ] Add OLMOCR_API_KEY secret
- [ ] Wait for build
- [ ] Test: https://mmrech-clinical-study-extraction.hf.space/health

GitHub Actions Method:
- [ ] Add HF_TOKEN secret to GitHub
- [ ] Add HF_USERNAME secret to GitHub
- [ ] Add workflow file to repository
- [ ] Trigger workflow
- [ ] Monitor deployment in Actions tab

---

## 🎉 Next Steps

After deployment:

1. **Test the API**
   ```bash
   curl https://mmrech-clinical-study-extraction.hf.space/health
   ```

2. **View API Docs**
   ```
   https://mmrech-clinical-study-extraction.hf.space/docs
   ```

3. **Extract Tables**
   ```bash
   curl -X POST "https://mmrech-clinical-study-extraction.hf.space/api/extract-tables-unified" \
     -F "file=@your_study.pdf" \
     -F "page_num=4"
   ```

4. **Share Your Space**
   - Share the URL with colleagues
   - Add to your documentation
   - Integrate into your workflow

---

## 📚 Documentation

All guides are ready:
- `DEPLOY_HUGGINGFACE.md` - Complete deployment guide
- `GITHUB_ACTIONS_SETUP.md` - GitHub Actions setup
- `QUICK_START.md` - Quick reference
- `ONE_CLICK_DEPLOYMENT.md` - One-click setup for servers

---

## 🆘 Need Help?

If you encounter issues:

1. **Check Space Logs**
   - Go to your Space
   - Click **Logs** tab
   - Look for error messages

2. **Verify Files**
   - Dockerfile exists and is named correctly
   - README.md exists
   - backend/ directory is complete

3. **Check Secrets**
   - OLMOCR_API_KEY is set
   - No typos in secret names

4. **Review Documentation**
   - DEPLOY_HUGGINGFACE.md has troubleshooting section
   - GITHUB_ACTIONS_SETUP.md has common issues

---

## 🎊 Ready to Deploy!

**Your credentials are ready:**
- ✅ HF_TOKEN: (provided separately)
- ✅ HF_USERNAME: mmrech
- ✅ OLMOCR_API_KEY: 4g6DiFP5V2myP6skXuqUPZDquyRCJ9wf

**Choose your method:**
- **Quick & Easy**: Direct upload (5 minutes)
- **Professional**: GitHub Actions (10 minutes)
- **Best**: Both! (10 minutes total)

**Start here:**
- Direct: https://huggingface.co/new-space
- GitHub: https://github.com/matheus-rech/clinical-study-extraction-app/settings/secrets/actions

---

**Let's deploy!** 🚀
