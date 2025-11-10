# Hugging Face Deployment Fix

## Problem
The Hugging Face Space deployment was showing only a JSON API response instead of the frontend UI when visiting the root URL.

## Root Cause
1. The FastAPI backend was serving JSON at the root endpoint `/`
2. No route was configured to serve the frontend HTML application  
3. The `Dockerfile.huggingface` only copied backend files, not frontend files

## Solution
Made minimal changes to fix the issue:

### 1. Updated `backend/app/main.py`
- Added imports for `FileResponse`, `HTMLResponse`, `StaticFiles`, and `Path`
- Added frontend directory detection that works for both Docker and local environments
- Mounted static files from the frontend directory at `/static/`
- Modified root endpoint `/` to serve `index.html` instead of JSON
- Added new `/api` endpoint for programmatic API info access
- Fallback to JSON response if frontend files are not available

### 2. Updated `Dockerfile.huggingface`
- Added line to copy frontend files: `COPY --chown=user frontend/public $HOME/app/frontend/public`

## Expected Behavior After Fix

### When visiting the Space URL:
- **Root URL (`/`)**: Shows the full HTML frontend UI with the clinical study extraction form
- **API Info (`/api`)**: Returns JSON with API documentation (for programmatic access)
- **API Docs (`/docs`)**: Shows Swagger UI documentation
- **Health Check (`/health`)**: Returns health status
- **All API endpoints (`/api/*`)**: Continue to work as before

## Verification Steps

1. **Visit the Hugging Face Space URL**: You should see the HTML interface, not JSON
2. **Check browser console**: Should see the frontend JavaScript loading
3. **Try uploading a PDF**: The UI should allow file upload and extraction
4. **Visit `/api` endpoint**: Should return JSON API information
5. **Visit `/docs` endpoint**: Should show Swagger UI

## Files Modified
- `backend/app/main.py` - Added frontend serving logic
- `Dockerfile.huggingface` - Added frontend files to Docker image

## No Breaking Changes
All existing API endpoints continue to work exactly as before. This fix only affects what is served at the root URL `/`.
