---
title: Clinical Study Extraction App
emoji: 🏥
colorFrom: blue
colorTo: green
sdk: docker
app_port: 7860
pinned: false
license: mit
tags:
  - fastapi
  - pdf
  - extraction
  - clinical-studies
  - medical
  - tables
  - figures
---

# 🏥 Clinical Study Extraction App

**Extract tables and figures from clinical study PDFs with AI-powered precision!**

This application provides advanced PDF extraction capabilities specifically designed for clinical studies and medical research papers.

## 🎯 Features

### 📊 Table Extraction (4 Methods)
- **PyMuPDF** - Fast, local extraction
- **Camelot** - 98.87% accuracy for complex tables
- **Tabula** - Optimized for scanned PDFs
- **olmOCR** - VLM-based AI extraction (fallback)

### 🖼️ Figure Extraction
- Complete figure rendering (not fragments)
- Caption detection
- High-quality image extraction (150 DPI)

### 📤 Export Formats
- **CSV** - Universal compatibility
- **Excel** - Formatted with headers and styling
- **JSON** - Structured data with metadata
- **HTML** - Styled, responsive tables
- **Annotated PDF** - Original PDF with highlights and annotations

## 🚀 Quick Start

### Using the API

```bash
# Health check
curl https://YOUR-SPACE-NAME.hf.space/health

# Upload and extract tables
curl -X POST "https://YOUR-SPACE-NAME.hf.space/api/extract-tables-unified" \
  -F "file=@your_study.pdf" \
  -F "page_num=4"

# Export to CSV
curl -X POST "https://YOUR-SPACE-NAME.hf.space/api/export/csv" \
  -H "Content-Type: application/json" \
  -d '{"tables": [...]}'
```

### API Documentation

Visit `https://YOUR-SPACE-NAME.hf.space/docs` for interactive API documentation.

## 📋 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/extract-tables-unified` | POST | Extract tables (tries all methods) |
| `/api/extract-figures-unified` | POST | Extract figures |
| `/api/export/csv` | POST | Export to CSV |
| `/api/export/excel` | POST | Export to Excel |
| `/api/export/json` | POST | Export to JSON |
| `/api/export/html` | POST | Export to HTML |
| `/api/export/annotated-pdf` | POST | Export annotated PDF |

## 🔧 Configuration

### Environment Variables

Set these in your Space Settings:

- `OLMOCR_API_KEY` - DeepInfra API key for VLM extraction (optional)
- `OLMOCR_PROVIDER` - Provider name (default: deepinfra)
- `OLMOCR_ENABLED` - Enable olmOCR fallback (default: true)

### Secrets Management

For sensitive keys, use Hugging Face Spaces Secrets:
1. Go to Space Settings
2. Add secrets under "Repository secrets"
3. They'll be available as environment variables

## 📊 Extraction Methods Comparison

| Method | Speed | Accuracy | Best For |
|--------|-------|----------|----------|
| PyMuPDF | ⚡⚡⚡ Fast (3.9s) | ⭐⭐⭐ Good | Bordered tables |
| Camelot | ⚡⚡ Medium (1.8s) | ⭐⭐⭐⭐⭐ Excellent (98.87%) | Complex clinical tables |
| Tabula | ⚡⚡⚡ Fastest (1.5s) | ⭐⭐⭐⭐ Very Good | Scanned PDFs |
| olmOCR | ⚡ Slow (33.9s) | ⭐⭐⭐⭐⭐ Excellent | Fallback for difficult PDFs |

## 🏗️ Architecture

```
┌─────────────────────────────────────┐
│         FastAPI Backend             │
│                                     │
│  ┌──────────────────────────────┐  │
│  │   Unified Extraction API     │  │
│  └──────────┬───────────────────┘  │
│             │                       │
│  ┌──────────▼───────────────────┐  │
│  │  PyMuPDF │ Camelot │ Tabula  │  │
│  │          │         │          │  │
│  │      olmOCR (VLM fallback)   │  │
│  └──────────────────────────────┘  │
│                                     │
│  ┌──────────────────────────────┐  │
│  │   Export Service             │  │
│  │  CSV │ Excel │ JSON │ HTML   │  │
│  │      Annotated PDF           │  │
│  └──────────────────────────────┘  │
└─────────────────────────────────────┘
```

## 💡 Usage Examples

### Python

```python
import requests

# Upload PDF and extract tables
url = "https://YOUR-SPACE-NAME.hf.space/api/extract-tables-unified"
files = {"file": open("study.pdf", "rb")}
data = {"page_num": 4}

response = requests.post(url, files=files, data=data)
tables = response.json()

print(f"Extracted {len(tables)} tables")
```

### JavaScript

```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('page_num', '4');

fetch('https://YOUR-SPACE-NAME.hf.space/api/extract-tables-unified', {
  method: 'POST',
  body: formData
})
.then(response => response.json())
.then(data => console.log('Tables:', data));
```

### cURL

```bash
# Extract tables from page 4
curl -X POST "https://YOUR-SPACE-NAME.hf.space/api/extract-tables-unified" \
  -F "file=@clinical_study.pdf" \
  -F "page_num=4" \
  | jq '.tables[0].markdown'

# Export to Excel
curl -X POST "https://YOUR-SPACE-NAME.hf.space/api/export/excel" \
  -H "Content-Type: application/json" \
  -d @extracted_tables.json \
  --output tables.xlsx
```

## 📚 Documentation

- **GitHub Repository**: [matheus-rech/clinical-study-extraction-app](https://github.com/matheus-rech/clinical-study-extraction-app)
- **Full Documentation**: See repository README
- **API Docs**: `/docs` endpoint (Swagger UI)

## 🔒 Privacy & Security

- ✅ No data stored permanently (ephemeral storage)
- ✅ Files deleted after processing
- ✅ Secure API key management via Secrets
- ✅ CORS enabled for web applications

## 🆘 Troubleshooting

### Common Issues

**Large PDFs timing out?**
- Try extracting specific pages instead of entire document
- Use smaller page ranges

**olmOCR not working?**
- Check if `OLMOCR_API_KEY` is set in Secrets
- Verify API key is valid at https://deepinfra.com

**Out of memory?**
- Reduce image DPI in extraction settings
- Process fewer pages at once
- Consider upgrading to persistent storage

## 📊 Performance

**Free Tier Specifications:**
- **Storage**: 50GB ephemeral
- **Memory**: 16GB RAM
- **CPU**: 2 vCPUs
- **Timeout**: 60 seconds per request

**Typical Performance:**
- Table extraction: 1-4 seconds per page
- Figure extraction: 2-5 seconds per page
- Export: < 1 second

## 🚀 Deployment

This Space is automatically deployed from the GitHub repository.

To deploy your own:
1. Fork the repository
2. Create a new Space on Hugging Face
3. Select "Docker" as SDK
4. Connect your GitHub repository
5. Add required secrets
6. Deploy!

## 📄 License

MIT License - See LICENSE file for details

## 🤝 Contributing

Contributions welcome! Please open an issue or pull request on GitHub.

## 📧 Support

- **Issues**: [GitHub Issues](https://github.com/matheus-rech/clinical-study-extraction-app/issues)
- **Discussions**: [GitHub Discussions](https://github.com/matheus-rech/clinical-study-extraction-app/discussions)

---

**Made with ❤️ for the medical research community**

Powered by PyMuPDF, Camelot, Tabula, and olmOCR
