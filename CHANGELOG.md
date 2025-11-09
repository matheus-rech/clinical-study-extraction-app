# Changelog

All notable changes to the Clinical Study Extraction System.

## [Unreleased]

### Fixed
- **Dependency Conflicts** (`backend/requirements.txt`)
  - Updated pypdfium2 from ==4.24.0 to >=4.27.0,<5.0.0 to satisfy camelot-py requirements
  - Removed opencv-python as camelot-py[cv] installs opencv-python-headless automatically
  - Resolved pip dependency resolution conflicts preventing installation

## [2.0.0] - 2025-11-08 - Production Ready Release

### Added

#### Backend Improvements
- ✅ **Production Configuration System** (`backend/app/core/config.py`)
  - Environment-aware settings (development/production)
  - Validation for critical production settings
  - Centralized configuration management
  - Type-safe settings with proper defaults

- ✅ **PDF Manipulation Module** (`backend/pdf_manipulation.py`)
  - PDF merging, splitting, and rotation
  - Metadata extraction
  - Encryption/decryption support
  - Image extraction from PDFs

- ✅ **Enhanced Dependencies** (`backend/requirements.txt`)
  - Added missing critical packages: scipy, pdf2image, habanero, biopython
  - Added security packages: python-jose
  - Organized dependencies by category

- ✅ **Environment-Based CORS**
  - Removed wildcard CORS for production security
  - Environment variable configuration
  - Proper logging on startup

#### Frontend Improvements
- ✅ **Production Dockerfile** (`frontend/Dockerfile`)
  - Multi-stage build for optimization
  - Nginx-based production server
  - Health check endpoint
  - Optimized image size

- ✅ **Nginx Configuration** (`frontend/nginx.conf`)
  - Gzip compression
  - Security headers (X-Frame-Options, CSP, etc.)
  - Static asset caching
  - Health check endpoint

#### Docker & Deployment
- ✅ **Production Docker Compose** (`docker-compose.prod.yml`)
  - Production-optimized configuration
  - Resource limits and reservations
  - Health checks with proper start periods
  - Network isolation
  - Automatic restarts

- ✅ **Docker Optimization**
  - `.dockerignore` files for backend and frontend
  - Reduced image sizes
  - Faster build times
  - Better layer caching

#### Scripts & Automation
- ✅ **Deployment Verification Script** (`verify-deployment.sh`)
  - Automated health checks
  - Backend and frontend validation
  - Color-coded output
  - Troubleshooting tips

- ✅ **Local Deployment Script** (`deploy-local.sh`)
  - One-command production deployment
  - Environment setup
  - Automatic verification
  - User-friendly output

#### Documentation
- ✅ **Production Setup Guide** (`PRODUCTION_SETUP.md`)
  - Comprehensive deployment instructions
  - Platform-specific guides (Railway, Vercel, Render, etc.)
  - Security checklist
  - Troubleshooting section
  - Monitoring and maintenance guide

- ✅ **Quick Start Guide** (`QUICK_START.md`)
  - 5-minute setup instructions
  - Multiple deployment options
  - Common commands reference
  - Troubleshooting tips

- ✅ **Production Environment Template** (`.env.production.example`)
  - All required environment variables
  - Detailed comments and instructions
  - Security best practices

#### Configuration Files
- ✅ **Enhanced Backend .env.example**
  - Complete environment variable reference
  - Organized by category
  - Production-ready defaults

### Changed

- 🔄 **CORS Configuration**
  - Changed from wildcard (`*`) to environment-based
  - Now requires explicit frontend URLs
  - Logged on application startup

- 🔄 **Logging Configuration**
  - Environment-aware log levels
  - Consistent log format
  - Startup configuration logging

- 🔄 **Development Docker Compose**
  - Added proper environment variables
  - Improved health checks
  - Better CORS configuration for development

### Security

- 🔒 **Production Security Enhancements**
  - SECRET_KEY requirement for production
  - CORS validation (no wildcards allowed)
  - Environment-based configuration
  - Security headers in nginx
  - Removed exposed API keys from documentation

- 🔒 **Configuration Validation**
  - Automatic validation on startup
  - Warnings for insecure production settings
  - Type-safe configuration

### Fixed

- 🐛 **Missing Dependencies**
  - Added scipy (required for image processing)
  - Added pdf2image (required for OCR)
  - Added habanero (required for CrossRef API)
  - Added biopython (required for PubMed API)

- 🐛 **Missing Module**
  - Created pdf_manipulation.py module
  - Implemented all referenced functions

- 🐛 **Configuration Issues**
  - Fixed hardcoded configuration values
  - Centralized settings management
  - Proper environment variable loading

### Deployment

The application is now production-ready and can be deployed to:

- ✅ Railway + Vercel (Free tier)
- ✅ Render (Full stack)
- ✅ DigitalOcean App Platform
- ✅ AWS / Azure / GCP (Docker)
- ✅ Any Docker-compatible platform

### Breaking Changes

⚠️ **CORS Configuration Required**
- `CORS_ORIGINS` environment variable must be set explicitly
- Wildcard (`*`) no longer works in production
- Update your deployment configuration

⚠️ **SECRET_KEY Required for Production**
- Must be set when `ENVIRONMENT=production`
- Generate with: `openssl rand -hex 32`

### Migration Guide

If upgrading from a previous version:

1. Copy `.env.production.example` to `.env.production`
2. Update environment variables with your values
3. Generate a new `SECRET_KEY`
4. Update `CORS_ORIGINS` with your frontend URL
5. Rebuild Docker images
6. Deploy using new configuration

### Testing

Run the verification script to test your deployment:

```bash
./verify-deployment.sh
```

For local production testing:

```bash
./deploy-local.sh
```

---

## [1.0.0] - 2025-01-07 - Initial Release

- Initial release with basic functionality
- PDF extraction features
- AI-powered extraction with Gemini
- Single-page HTML frontend
- FastAPI backend
- Docker support

---

## Version Numbering

This project follows [Semantic Versioning](https://semver.org/):
- MAJOR version for incompatible API changes
- MINOR version for backwards-compatible functionality
- PATCH version for backwards-compatible bug fixes
