# 🔄 GitHub Actions Auto-Deploy Setup

Automatically deploy to Hugging Face Spaces when you push to GitHub!

---

## 🎯 What This Does

- ✅ **Push to `main`** → Deploys to production Space
- ✅ **Push to `develop`** → Deploys to staging Space
- ✅ **Pull request** → Runs tests only
- ✅ **Manual trigger** → Rollback to previous version

---

## 📋 Prerequisites

1. ✅ Hugging Face account
2. ✅ Hugging Face Space created (see DEPLOY_HUGGINGFACE.md)
3. ✅ GitHub repository
4. ✅ Hugging Face access token

---

## 🚀 Setup (5 Minutes)

### Step 1: Get Hugging Face Token (2 minutes)

1. Go to https://huggingface.co/settings/tokens
2. Click **New token**
3. Fill in:
   - **Name**: `GitHub Actions Deploy`
   - **Role**: **Write**
4. Click **Generate**
5. **Copy the token** (you won't see it again!)

### Step 2: Add GitHub Secrets (2 minutes) ⚠️ REQUIRED

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**

Add these secrets (both are **REQUIRED**):

| Secret Name | Value | Example | Required |
|-------------|-------|---------|----------|
| `HF_TOKEN` | Your Hugging Face token | `hf_xxxxxxxxxxxxx` | ✅ YES |
| `HF_USERNAME` | Your Hugging Face username | `your-username` | ✅ YES |

**⚠️ Important:** The workflow will fail with a clear error message if these secrets are not set. The error will look like:
```
❌ Error: HF_USERNAME secret is not set!
fatal: repository 'https://huggingface.co/spaces//clinical-study-extraction/' not found
```
This happens because the URL becomes malformed with double slashes when `HF_USERNAME` is empty.

**📚 For detailed step-by-step instructions, see [SECRETS_SETUP.md](SECRETS_SETUP.md)**

**Optional secrets:**
| Secret Name | Value | Purpose |
|-------------|-------|---------|
| `SLACK_WEBHOOK` | Slack webhook URL | Deployment notifications |

### Step 3: Create Workflow File (1 minute)

The workflow file is already in your repository at:
```
.github/workflows/deploy-huggingface.yml
```

**If it's not there**, create it manually:

1. Go to GitHub → **Actions** → **New workflow**
2. Click **set up a workflow yourself**
3. Copy content from `.github/workflows/deploy-huggingface.yml`
4. Commit to `main` branch

### Step 4: Test Deployment (30 seconds)

1. Make a small change to README.md
2. Commit and push to `main`:
   ```bash
   git add README.md
   git commit -m "test: Trigger deployment"
   git push origin main
   ```

3. Go to **Actions** tab on GitHub
4. Watch the deployment progress!

### Step 5: Verify Deployment (1 minute)

After ~5 minutes, check:

```bash
# Health check
curl https://YOUR-USERNAME-clinical-study-extraction.hf.space/health

# API docs
open https://YOUR-USERNAME-clinical-study-extraction.hf.space/docs
```

---

## 🔄 Workflow Overview

### Jobs

```
┌─────────────────────────────────────────────┐
│         1. Build and Test                   │
│  - Install dependencies                     │
│  - Run linting                              │
│  - Run tests                                │
└────────────┬────────────────────────────────┘
             │
    ┌────────▼────────┐
    │  Main branch?   │
    └────┬───────┬────┘
         │       │
    Yes  │       │  No (develop)
         │       │
┌────────▼───────┐   ┌────────▼────────┐
│ 2. Deploy Prod │   │ 3. Deploy Stage │
│  - Clone Space │   │  - Clone Space  │
│  - Copy files  │   │  - Copy files   │
│  - Push to HF  │   │  - Push to HF   │
└────────┬───────┘   └─────────────────┘
         │
┌────────▼───────┐
│ 4. Validate    │
│  - Health check│
│  - Test APIs   │
└────────────────┘
```

### Triggers

| Event | Branch | Action |
|-------|--------|--------|
| Push | `main` | Deploy to production |
| Push | `develop` | Deploy to staging |
| Pull Request | any | Run tests only |
| Manual | any | Rollback deployment |

---

## 📊 Workflow Details

### Job 1: Build and Test
- **Duration**: ~2 minutes
- **Actions**:
  - Install Python dependencies
  - Run flake8 linting
  - Run pytest tests
- **Result**: Must pass for deployment to proceed

### Job 2: Deploy Production
- **Duration**: ~3 minutes
- **Trigger**: Push to `main` branch
- **Actions**:
  - Clone Hugging Face Space
  - Copy backend/, Dockerfile, README
  - Commit and push to Space
  - Create deployment summary

### Job 3: Deploy Staging
- **Duration**: ~3 minutes
- **Trigger**: Push to `develop` branch
- **Actions**:
  - Same as production
  - Deploys to staging Space

### Job 4: Validate Deployment
- **Duration**: ~2 minutes
- **Actions**:
  - Wait for Space to build
  - Check health endpoint
  - Test API documentation
  - Verify OpenAPI schema

### Job 5: Rollback
- **Trigger**: Manual workflow dispatch
- **Actions**:
  - Clone Space repository
  - Reset to previous commit
  - Force push to Space

---

## 🎯 Usage Examples

### Automatic Deployment

```bash
# Make changes
git add .
git commit -m "feat: Add new feature"

# Push to main → Auto-deploys to production
git push origin main

# Push to develop → Auto-deploys to staging
git push origin develop
```

### Manual Rollback

1. Go to **Actions** tab on GitHub
2. Click **Deploy to Hugging Face Spaces**
3. Click **Run workflow**
4. Select branch
5. Click **Run workflow**

### View Deployment Status

1. Go to **Actions** tab
2. Click on the latest workflow run
3. View logs for each job
4. Check deployment summary

---

## 📝 Deployment Summary

After each deployment, you'll see a summary:

```markdown
## 🚀 Deployment to Hugging Face Spaces Successful!

**Environment:** Production
**Space:** your-username/clinical-study-extraction
**Branch:** main
**Commit:** abc123...
**Deployed by:** github-username

### 🔗 Access URLs
- **Space URL:** https://huggingface.co/spaces/your-username/clinical-study-extraction
- **API Endpoint:** https://your-username-clinical-study-extraction.hf.space
- **API Docs:** https://your-username-clinical-study-extraction.hf.space/docs

### 📊 Build Info
- Build time: 2025-11-08 12:34:56
- Workflow: Deploy to Hugging Face Spaces
- Run ID: 1234567890
```

---

## 🔒 Security Best Practices

### Secrets Management

✅ **Do:**
- Use GitHub Secrets for tokens
- Use write-only tokens
- Rotate tokens regularly
- Use different tokens for prod/staging

❌ **Don't:**
- Commit tokens to repository
- Share tokens publicly
- Use admin tokens
- Hardcode credentials

### Token Permissions

**Hugging Face Token:**
- **Role**: Write (not Admin)
- **Scope**: Spaces only
- **Expiry**: Set expiration date

---

## 🆘 Troubleshooting

### Workflow Fails with "HF_USERNAME secret is not set"

**Error Message:**
```
❌ Error: HF_USERNAME secret is not set!

Please add the HF_USERNAME secret to your GitHub repository:
1. Go to Settings → Secrets and variables → Actions
2. Click 'New repository secret'
3. Name: HF_USERNAME
4. Value: Your Hugging Face username (e.g., 'your-username')
```

**Root Cause:**
The `HF_USERNAME` GitHub secret is not configured or is empty.

**Solution:**
1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add:
   - **Name:** `HF_USERNAME`
   - **Value:** Your Hugging Face username (the one you use to log in)
5. Save the secret
6. Re-run the failed workflow

### Workflow Fails with "repository not found" and double slashes in URL

**Error Message:**
```
fatal: repository 'https://huggingface.co/spaces//clinical-study-extraction/' not found
```

**Root Cause:**
Notice the double slashes (`//`) after `spaces/`? This indicates the `HF_USERNAME` secret is missing or empty.

**Solution:**
Follow the steps in the section above to add the `HF_USERNAME` secret.

### Workflow Fails at "Deploy to Hugging Face Space"

**Error: "Authentication failed"**
```
Solution: Check HF_TOKEN secret
1. Go to GitHub Settings → Secrets
2. Verify HF_TOKEN is set correctly
3. Generate new token if needed
```

**Error: "Space not found"**
```
Solution: Create Space first
1. Go to https://huggingface.co/new-space
2. Create Space with name: clinical-study-extraction
3. Retry workflow
```

### Validation Fails

**Error: "Health check failed"**
```
Solution: Wait longer for build
1. Space may still be building
2. Check Space logs on Hugging Face
3. Verify Dockerfile is correct
```

### Deployment Succeeds but Space Doesn't Work

**Check Space Logs:**
1. Go to https://huggingface.co/spaces/YOUR-USERNAME/clinical-study-extraction
2. Click **Logs** tab
3. Look for error messages

**Common Issues:**
- Missing dependencies in requirements.txt
- Port not set to 7860
- User permissions (must be user ID 1000)

---

## 📊 Monitoring

### GitHub Actions

View deployment history:
1. Go to **Actions** tab
2. See all workflow runs
3. Filter by status (success/failure)
4. Download logs

### Hugging Face Spaces

View Space metrics:
1. Go to your Space
2. Click **Analytics** tab
3. See:
   - API calls
   - Response times
   - Error rates
   - Storage usage

---

## 🎯 Advanced Configuration

### Custom Deployment Branch

Edit `.github/workflows/deploy-huggingface.yml`:

```yaml
on:
  push:
    branches:
      - main
      - production  # Add custom branch
```

### Deploy on Tag

```yaml
on:
  push:
    tags:
      - 'v*'  # Deploy on version tags
```

### Conditional Deployment

```yaml
jobs:
  deploy-production:
    if: |
      github.ref == 'refs/heads/main' && 
      contains(github.event.head_commit.message, '[deploy]')
```

### Slack Notifications

1. Create Slack webhook: https://api.slack.com/messaging/webhooks
2. Add to GitHub Secrets: `SLACK_WEBHOOK`
3. Workflow will automatically send notifications

---

## ✅ Checklist

⚠️ **Critical:** Both `HF_TOKEN` and `HF_USERNAME` secrets must be set before deployment!

Setup:
- [ ] Created Hugging Face Space
- [ ] Generated HF token with write access
- [ ] Added `HF_TOKEN` to GitHub Secrets ⚠️ REQUIRED
- [ ] Added `HF_USERNAME` to GitHub Secrets ⚠️ REQUIRED
- [ ] Workflow file exists in `.github/workflows/`

Testing:
- [ ] Pushed to `main` branch
- [ ] Workflow ran successfully
- [ ] Space deployed and running
- [ ] Health check passes
- [ ] API docs accessible

Optional:
- [ ] Created staging Space
- [ ] Set up Slack notifications
- [ ] Configured custom branches
- [ ] Tested rollback procedure

---

## 📚 Resources

- **GitHub Actions Docs**: https://docs.github.com/en/actions
- **Hugging Face Spaces**: https://huggingface.co/docs/hub/spaces
- **Secrets Setup Guide**: [SECRETS_SETUP.md](SECRETS_SETUP.md) - Quick guide for configuring GitHub secrets
- **Workflow File**: `.github/workflows/deploy-huggingface.yml`
- **Deployment Guide**: `DEPLOY_HUGGINGFACE.md`

---

## 🎉 Success!

You now have automatic deployment to Hugging Face Spaces!

**Workflow:**
```
Code → Push to GitHub → Auto-deploy to HF Spaces → Live in 5 minutes!
```

**Next Steps:**
1. Make changes to your code
2. Push to `main` branch
3. Watch automatic deployment
4. Access your updated Space!

---

**Happy deploying!** 🚀
