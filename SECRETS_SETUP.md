# 🔐 GitHub Secrets Setup Guide

This guide explains how to configure the required GitHub repository secrets for automated deployment to Hugging Face Spaces.

---

## ⚠️ Required Secrets

The GitHub Actions workflow **requires** these two secrets to be configured:

| Secret Name | Purpose | Required |
|-------------|---------|----------|
| `HF_USERNAME` | Your Hugging Face username | ✅ YES |
| `HF_TOKEN` | Hugging Face access token with write permissions | ✅ YES |

**Without these secrets, the deployment workflow will fail.**

---

## 🚀 Quick Setup (3 Minutes)

### Step 1: Get Your Hugging Face Username

Your Hugging Face username is the one you use to log in to https://huggingface.co

Example: If your profile is `https://huggingface.co/john-doe`, your username is `john-doe`

### Step 2: Generate Hugging Face Token

1. Go to https://huggingface.co/settings/tokens
2. Click **"New token"**
3. Configure the token:
   - **Name**: `GitHub Actions Deploy` (or any descriptive name)
   - **Role**: **Write** (required for pushing to Spaces)
4. Click **"Generate token"**
5. **Copy the token immediately** (you won't see it again!)
   - It will look like: `hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### Step 3: Add Secrets to GitHub

1. Go to your GitHub repository
2. Click **Settings** (top navigation)
3. In the left sidebar, click **Secrets and variables** → **Actions**
4. Click **"New repository secret"**

#### Add HF_USERNAME

1. Click **"New repository secret"**
2. Enter:
   - **Name**: `HF_USERNAME`
   - **Secret**: Your Hugging Face username (e.g., `john-doe`)
3. Click **"Add secret"**

#### Add HF_TOKEN

1. Click **"New repository secret"** again
2. Enter:
   - **Name**: `HF_TOKEN`
   - **Secret**: Your Hugging Face token (e.g., `hf_xxxxxxxxxxxxx`)
3. Click **"Add secret"**

### Step 4: Verify Setup

After adding both secrets, you should see:
- ✅ `HF_USERNAME`
- ✅ `HF_TOKEN`

in your repository secrets list.

---

## ✅ Testing Your Setup

1. Make a small change to any file (e.g., README.md)
2. Commit and push to the `main` branch:
   ```bash
   git add .
   git commit -m "test: Trigger deployment"
   git push origin main
   ```
3. Go to the **Actions** tab in your GitHub repository
4. Watch the deployment workflow run
5. If secrets are configured correctly, the workflow will:
   - ✅ Pass secret validation
   - ✅ Deploy to Hugging Face Spaces
   - ✅ Complete successfully

---

## 🔍 How Secrets Are Used

The GitHub Actions workflow uses these secrets in several places:

### Environment Variable

```yaml
env:
  HF_SPACE_REPO: ${{ secrets.HF_USERNAME }}/clinical-study-extraction
```

This constructs the full repository URL for your Hugging Face Space.

### Secret Validation Step

```yaml
- name: 🔍 Validate secrets
  env:
    HF_TOKEN: ${{ secrets.HF_TOKEN }}
    HF_USERNAME: ${{ secrets.HF_USERNAME }}
  run: |
    if [ -z "$HF_USERNAME" ]; then
      echo "❌ Error: HF_USERNAME secret is not set!"
      exit 1
    fi
    if [ -z "$HF_TOKEN" ]; then
      echo "❌ Error: HF_TOKEN secret is not set!"
      exit 1
    fi
```

This step checks that both secrets are configured before proceeding with deployment.

### Deployment Step

```yaml
- name: 🤗 Deploy to Hugging Face Space
  env:
    HF_TOKEN: ${{ secrets.HF_TOKEN }}
    HF_USERNAME: ${{ secrets.HF_USERNAME }}
  run: |
    git clone https://huggingface.co/spaces/$HF_USERNAME/$SPACE_NAME hf-space
    # ... deployment steps ...
    git push https://USER:$HF_TOKEN@huggingface.co/spaces/$HF_USERNAME/$SPACE_NAME main
```

The token is used to authenticate Git operations when pushing to Hugging Face.

---

## 🚨 Common Errors

### Error: "HF_USERNAME secret is not set!"

**What you'll see:**
```
❌ Error: HF_USERNAME secret is not set!

Please add the HF_USERNAME secret to your GitHub repository:
1. Go to Settings → Secrets and variables → Actions
2. Click 'New repository secret'
3. Name: HF_USERNAME
4. Value: Your Hugging Face username (e.g., 'your-username')
```

**Solution:**
Follow Step 3 above to add the `HF_USERNAME` secret.

### Error: "HF_TOKEN secret is not set!"

**What you'll see:**
```
❌ Error: HF_TOKEN secret is not set!

Please add the HF_TOKEN secret to your GitHub repository:
1. Go to https://huggingface.co/settings/tokens
2. Create a new token with 'Write' access
3. Go to GitHub Settings → Secrets and variables → Actions
4. Click 'New repository secret'
5. Name: HF_TOKEN
6. Value: Your Hugging Face token
```

**Solution:**
Follow Steps 2-3 above to generate and add the `HF_TOKEN` secret.

### Error: "repository not found" with double slashes

**What you'll see:**
```
fatal: repository 'https://huggingface.co/spaces//clinical-study-extraction/' not found
```

**Root Cause:**
Notice the double slashes (`//`) after `spaces/`? This means `HF_USERNAME` is empty or not set.

**Solution:**
The `HF_USERNAME` secret is missing. Add it following Step 3 above.

### Error: "Authentication failed"

**What you'll see:**
```
remote: Invalid username or password.
fatal: Authentication failed
```

**Possible Causes:**
1. `HF_TOKEN` is incorrect or expired
2. Token doesn't have **Write** permissions
3. Token was regenerated but not updated in GitHub

**Solution:**
1. Generate a new token with **Write** access
2. Update the `HF_TOKEN` secret in GitHub with the new token

---

## 🔒 Security Best Practices

### ✅ Do:
- Use GitHub Secrets for storing tokens (they are encrypted)
- Use tokens with **Write** access only (not Admin)
- Set token expiration dates
- Rotate tokens regularly (every 90 days recommended)
- Use different tokens for production and staging

### ❌ Don't:
- Never commit tokens to your repository
- Never share tokens publicly
- Never use tokens with more permissions than needed
- Never hardcode credentials in code

---

## 🔄 Updating Secrets

If you need to update a secret (e.g., token expired):

1. Generate a new Hugging Face token
2. Go to **Settings** → **Secrets and variables** → **Actions**
3. Click on the secret name (e.g., `HF_TOKEN`)
4. Click **"Update secret"**
5. Enter the new value
6. Click **"Update secret"**

The next workflow run will use the updated secret.

---

## 📚 Related Documentation

- **GitHub Actions Setup**: [GITHUB_ACTIONS_SETUP.md](GITHUB_ACTIONS_SETUP.md) - Complete workflow documentation
- **Hugging Face Deployment**: [DEPLOY_HUGGINGFACE.md](DEPLOY_HUGGINGFACE.md) - Manual deployment guide
- **Main README**: [README.md](README.md) - Project overview and quick start

---

## 🆘 Need Help?

If you're still having issues:

1. Check that both secrets are added in **Settings** → **Secrets and variables** → **Actions**
2. Verify your Hugging Face token has **Write** permissions
3. Check the workflow logs in the **Actions** tab for specific error messages
4. Review the [GITHUB_ACTIONS_SETUP.md](GITHUB_ACTIONS_SETUP.md) troubleshooting section

---

## ✅ Checklist

Before running the deployment workflow:

- [ ] Created a Hugging Face account
- [ ] Created a Hugging Face Space named `clinical-study-extraction`
- [ ] Generated a Hugging Face token with **Write** access
- [ ] Added `HF_USERNAME` secret to GitHub repository
- [ ] Added `HF_TOKEN` secret to GitHub repository
- [ ] Verified both secrets are visible in **Settings** → **Secrets and variables** → **Actions**

Once all items are checked, you're ready to deploy! 🚀

---

**Last Updated**: 2025-11-10
