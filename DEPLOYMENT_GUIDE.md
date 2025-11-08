# Clinical Study Extraction App - Deployment Guide

## Overview

This is a comprehensive clinical study extraction system with AI-powered features for extracting structured data from clinical trial PDFs. The system uses FastAPI backend with Python and a standalone HTML/JavaScript frontend.

## Key Improvements Made

### 1. Enhanced Text Extraction
- **Replaced PDF.js text extraction** with backend-based **pdfplumber** extraction
- **Layout-preserving text extraction** using `extract_text(layout=True)`
- **Full document processing** - AI now analyzes complete PDF text (all pages) instead of truncated text
- Added new endpoint: `/api/extract-text-for-ai` for high-quality text extraction

### 2. AI Integration Fixes
- **Removed Lector library dependency** - replaced with custom Gemini API integration
- **Fixed Gemini API compatibility** - removed incompatible `google_search` tool
- **Updated to correct Gemini model**: `gemini-2.5-flash-preview-05-20`
- **Full document AI analysis** - removed 50,000 character truncation limit
- **Proper JSON schema support** for structured extraction

### 3. Backend Improvements
- **Fixed PdfMerger import** - updated to use `PdfWriter` from pypdf
- **Fixed indentation errors** in config.py
- **Added CORS support** for all origins in development
- **Enhanced API endpoint** for AI-optimized text extraction

### 4. Configuration
- **Gemini API key** properly configured in both frontend and backend
- **Environment variables** set up correctly
- **CORS** configured for development

## System Architecture

```
clinical-study-extraction-app/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI application
│   │   ├── core/
│   │   │   └── config.py        # Configuration
│   │   └── api/
│   │       └── endpoints.py     # API routes
│   ├── pdf_manipulation.py      # PDF processing utilities
│   ├── requirements.txt         # Python dependencies
│   └── .env                     # Environment configuration
└── frontend/
    └── public/
        └── index.html           # Standalone web application
```

## Prerequisites

- Python 3.11+
- Node.js 22+ (for serving frontend)
- Tesseract OCR (for image-based text extraction)
- Gemini API key

## Installation

### 1. Clone the Repository

```bash
cd /home/ubuntu
gh repo clone matheus-rech/clinical-study-extraction-app
cd clinical-study-extraction-app
```

### 2. Install System Dependencies

```bash
sudo apt-get update
sudo apt-get install -y tesseract-ocr tesseract-ocr-eng
```

### 3. Set Up Backend

```bash
cd backend

# Install Python dependencies
sudo pip3 install -r requirements.txt

# Create .env file
cat > .env << 'EOF'
# Application
APP_NAME="Clinical Study PDF Processor"
APP_VERSION="2.0.0"
ENVIRONMENT="development"
DEBUG=true

# Server
HOST="0.0.0.0"
PORT=8000

# CORS
CORS_ORIGINS=["*"]

# API Keys
GEMINI_API_KEY="AIzaSyCiFarLGok5TtUj2N6T8Rl1R91MUkNCnVg"

# File Upload
MAX_UPLOAD_SIZE=52428800
ALLOWED_EXTENSIONS=[".pdf"]

# Processing
MAX_WORKERS=4
TIMEOUT_SECONDS=300
EOF
```

### 4. Set Up Frontend

```bash
cd ../frontend

# Create .env file
cat > .env << 'EOF'
VITE_API_URL=http://localhost:8000
VITE_GEMINI_API_KEY=AIzaSyCiFarLGok5TtUj2N6T8Rl1R91MUkNCnVg
EOF

# Update index.html with API key (already done in deployed version)
```

## Running the Application

### Start Backend

```bash
cd /home/ubuntu/clinical-study-extraction-app/backend
nohup python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload > /tmp/backend.log 2>&1 &
```

### Start Frontend

```bash
cd /home/ubuntu/clinical-study-extraction-app/frontend/public
nohup python3 -m http.server 3000 > /tmp/frontend.log 2>&1 &
```

### Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs

## API Endpoints

### Core Endpoints

- `POST /api/extract-metadata` - Extract PDF metadata
- `POST /api/extract-tables` - Extract tables from PDF
- `POST /api/extract-images` - Extract images from PDF
- `POST /api/extract-text-for-ai` - Extract layout-preserved text for AI (NEW)

### Health Check

- `GET /` - API health check

## Features

### 1. PDF Processing
- **Load PDF**: Upload clinical study PDFs (up to 50MB)
- **Text Extraction**: High-quality layout-preserving text extraction
- **Table Extraction**: Extract tables with structure preservation
- **Image Extraction**: Extract figures and images from PDFs

### 2. AI-Powered Extraction
- **Auto-Generate PICO-T Summary**: Automatically extract Population, Intervention, Comparator, Outcomes, Timing, and Study Type
- **Auto-Extract Baseline Data**: Extract demographic and clinical baseline data
- **Auto-Generate Summary**: Generate concise study summaries
- **Q&A Feature**: Ask questions about the loaded PDF

### 3. Manual Data Entry
- **8-step extraction workflow**: Structured data entry for clinical studies
- **Field validation**: AI-powered field validation
- **Provenance tracking**: Track source of all extracted data

### 4. Export Options
- **JSON Export**: Export data in JSON format
- **CSV Export**: Export data in CSV format
- **Audit Trail**: Export extraction audit log
- **PDF Report**: Generate PDF report (planned)

## Testing

### Test with Sample PDF

```bash
# Download a sample clinical study PDF
curl -L -o /tmp/test-study.pdf "https://www.nejm.org/doi/pdf/10.1056/NEJMoa2206732"

# Upload via web interface or API
curl -X POST http://localhost:8000/api/extract-metadata \
  -F "file=@/tmp/test-study.pdf"
```

### Verify AI Features

1. Load a PDF in the web interface
2. Click "✨ Auto-Generate PICO-T Summary"
3. Verify that all PICO-T fields are populated
4. Check the Extraction Log for provenance

## Troubleshooting

### Backend Issues

```bash
# Check backend logs
tail -f /tmp/backend.log

# Check if backend is running
curl http://localhost:8000/

# Restart backend
pkill -f uvicorn
cd /home/ubuntu/clinical-study-extraction-app/backend
nohup python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload > /tmp/backend.log 2>&1 &
```

### Frontend Issues

```bash
# Check frontend logs
tail -f /tmp/frontend.log

# Restart frontend
pkill -f "http.server 3000"
cd /home/ubuntu/clinical-study-extraction-app/frontend/public
nohup python3 -m http.server 3000 > /tmp/frontend.log 2>&1 &
```

### CORS Issues

If you encounter CORS errors, ensure the backend `.env` file has:
```
CORS_ORIGINS=["*"]
```

## Production Deployment

### Recommendations

1. **Use a proper web server**: Deploy with Nginx or Apache
2. **Secure API keys**: Use environment variables or secret management
3. **Enable HTTPS**: Use SSL/TLS certificates
4. **Restrict CORS**: Limit CORS origins to your domain
5. **Add authentication**: Implement user authentication
6. **Use a process manager**: Use systemd or supervisor for backend
7. **Add logging**: Implement proper logging and monitoring
8. **Database integration**: Add database for storing extractions

### Example Systemd Service

```ini
[Unit]
Description=Clinical Study Extraction Backend
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/clinical-study-extraction-app/backend
Environment="PATH=/usr/local/bin:/usr/bin:/bin"
ExecStart=/usr/bin/python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
```

## Future Enhancements

### Recommended Improvements

1. **Enhanced Table Extraction**
   - Integrate pdffigures2 for better table/figure extraction
   - Use Docling or MinerU for complex table structures
   - Add OCR-based table extraction for scanned PDFs

2. **Better Text Extraction**
   - Add support for scanned PDFs with OCR
   - Implement browser-based reader mode for better text quality
   - Add support for multi-column layouts

3. **Advanced AI Features**
   - Add support for multiple AI models (Claude, GPT-4, etc.)
   - Implement confidence scores for extractions
   - Add automatic citation generation
   - Implement batch processing for multiple PDFs

4. **User Interface**
   - Add dark mode support
   - Improve mobile responsiveness
   - Add keyboard shortcuts
   - Implement undo/redo functionality

5. **Data Management**
   - Add database integration (PostgreSQL)
   - Implement user authentication and authorization
   - Add project/workspace management
   - Implement version control for extractions

## License

This project is licensed under the MIT License.

## Support

For issues or questions, please contact the development team or create an issue in the GitHub repository.

## Acknowledgments

- **Gemini API** by Google for AI-powered extraction
- **pdfplumber** for PDF text extraction
- **FastAPI** for the backend framework
- **PDF.js** for PDF rendering in the browser
