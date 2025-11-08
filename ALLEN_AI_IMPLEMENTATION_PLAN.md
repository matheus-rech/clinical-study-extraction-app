# Allen AI Integration - Implementation Plan

## Executive Summary

This document provides a **step-by-step implementation plan** for integrating **olmOCR** (Allen AI's vision language model) as a fourth fallback method for PDF extraction in the clinical study extraction application.

**Total Estimated Effort**: **6-8 hours**  
**Complexity**: **Medium**  
**Recommended Timeline**: **1-2 days**

---

## Implementation Overview

### Goal
Add olmOCR as a fourth fallback extraction method in the unified extraction API, providing state-of-the-art VLM-based extraction when traditional methods (PyMuPDF, Camelot, Tabula) fail.

### Approach
Use **external inference provider** (DeepInfra) to avoid GPU requirements and simplify deployment.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    User Request (PDF)                        │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              Unified Extraction API                          │
│                                                              │
│  Try methods in order:                                       │
│  1. PyMuPDF (fast, local, rule-based)                       │
│  2. Camelot (accurate, local, specialized)                  │
│  3. Tabula (backup, local, Java-based)                      │
│  4. olmOCR (VLM-based, external API) ← NEW                  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                 Return Best Result                           │
└─────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Setup and Prerequisites (30 minutes)

### Step 1.1: Sign Up for DeepInfra API (10 minutes)

1. Go to https://deepinfra.com
2. Sign up for free account
3. Navigate to API Keys section
4. Generate new API key
5. Save API key securely

**Free Tier**:
- 100 requests/day
- Sufficient for testing and fallback usage

### Step 1.2: Install Dependencies (5 minutes)

```bash
cd /home/ubuntu/clinical-study-extraction-app/backend

# No new dependencies needed! 
# We already have:
# - requests (for API calls)
# - pymupdf (for PDF to image conversion)
# - PIL/Pillow (for image processing)

# Verify installations
python3.11 -c "import requests; import fitz; from PIL import Image; print('All dependencies available!')"
```

### Step 1.3: Configure Environment Variables (5 minutes)

**File**: `backend/.env`

```bash
# Add olmOCR configuration
OLMOCR_API_KEY=your_deepinfra_api_key_here
OLMOCR_PROVIDER=deepinfra
OLMOCR_ENABLED=true  # Set to false to disable olmOCR fallback
```

### Step 1.4: Update .gitignore (5 minutes)

Ensure API keys are not committed:

```bash
# Verify .env is in .gitignore
grep -q "\.env" .gitignore || echo ".env" >> .gitignore
```

### Step 1.5: Create Test Directory (5 minutes)

```bash
mkdir -p /home/ubuntu/clinical-study-extraction-app/tests/olmocr
cd /home/ubuntu/clinical-study-extraction-app/tests/olmocr
```

---

## Phase 2: Core Implementation (3-4 hours)

### Step 2.1: Create olmOCR Extraction Module (2 hours)

**File**: `backend/app/api/olmocr_extraction.py`

**Implementation**: See full code in ALLEN_AI_TECHNICAL_REQUIREMENTS.md

**Key Components**:
1. `OlmOCRExtractor` class
   - `pdf_page_to_base64()` - Convert PDF to image
   - `extract_via_api()` - Call olmOCR API
   - `parse_tables_from_markdown()` - Parse markdown tables
   - `extract_tables()` - Main extraction method

2. `extract_tables_olmocr()` function
   - Public API for unified extraction

**Testing**:
```bash
# Create test script
cat > test_olmocr_module.py << 'EOF'
import os
from backend.app.api.olmocr_extraction import extract_tables_olmocr

# Load API key
api_key = os.getenv("OLMOCR_API_KEY")
if not api_key:
    print("ERROR: OLMOCR_API_KEY not set")
    exit(1)

# Test extraction
pdf_path = "test_samples/Won2024.pdf"
print("Testing olmOCR extraction on page 4...")

tables = extract_tables_olmocr(pdf_path, page_num=4, api_key=api_key)

print(f"\n✅ Extracted {len(tables)} table(s)")
for i, table in enumerate(tables):
    print(f"\nTable {i+1}:")
    print(f"  - Rows: {table['rows']}")
    print(f"  - Cols: {table['cols']}")
    print(f"  - Method: {table['extraction_method']}")
    print(f"  - Markdown preview: {table['markdown'][:100]}...")
EOF

# Run test
python3.11 test_olmocr_module.py
```

**Expected Output**:
```
Testing olmOCR extraction on page 4...

✅ Extracted 1 table(s)

Table 1:
  - Rows: 8
  - Cols: 5
  - Method: olmocr_vlm
  - Markdown preview: | Table. Baseline Characteristics of Surgically and Conservatively Treated Patients...
```

### Step 2.2: Update Unified Extraction API (1 hour)

**File**: `backend/app/api/unified_extraction.py`

**Changes**:

1. Add import:
```python
from app.api.olmocr_extraction import extract_tables_olmocr
```

2. Update `TABLE_METHODS`:
```python
TABLE_METHODS = [
    ("pymupdf", extract_tables_pymupdf),
    ("camelot", extract_tables_camelot),
    ("tabula", extract_tables_tabula),
    ("olmocr", extract_tables_olmocr)  # NEW
]
```

3. Update `extract_tables()` method:
```python
@staticmethod
def extract_tables(pdf_path: str, page_num: Optional[int] = None, 
                  method: Optional[str] = None,
                  olmocr_api_key: Optional[str] = None,
                  enable_olmocr: bool = True) -> Dict[str, Any]:
    """
    Extract tables using multiple methods with intelligent fallback
    
    Args:
        pdf_path: Path to PDF file
        page_num: Specific page number (1-indexed), or None for all pages
        method: Force specific method ('pymupdf', 'camelot', 'tabula', 'olmocr')
        olmocr_api_key: API key for olmOCR (optional, falls back to env var)
        enable_olmocr: Whether to try olmOCR as fallback (default True)
        
    Returns:
        Dictionary with extraction results
    """
    errors = []
    methods_tried = []
    
    # Get olmOCR API key from env if not provided
    if not olmocr_api_key:
        olmocr_api_key = os.getenv("OLMOCR_API_KEY")
    
    # If specific method requested, try only that method
    if method:
        for method_name, extract_func in UnifiedExtractor.TABLE_METHODS:
            if method_name == method:
                try:
                    if method_name == "olmocr":
                        if not olmocr_api_key:
                            return {
                                "success": False,
                                "error": "olmOCR API key required",
                                "method_used": None
                            }
                        tables = extract_func(pdf_path, page_num, api_key=olmocr_api_key)
                    else:
                        tables = extract_func(pdf_path, page_num)
                    
                    if tables:
                        return {
                            "success": True,
                            "tables": tables,
                            "method_used": method_name,
                            "methods_tried": [method_name],
                            "table_count": len(tables),
                            "errors": []
                        }
                except Exception as e:
                    return {
                        "success": False,
                        "error": str(e),
                        "method_used": None,
                        "methods_tried": [method_name]
                    }
        
        return {
            "success": False,
            "error": f"Unknown method: {method}",
            "method_used": None
        }
    
    # Try each method in order
    for method_name, extract_func in UnifiedExtractor.TABLE_METHODS:
        # Skip olmOCR if disabled or no API key
        if method_name == "olmocr":
            if not enable_olmocr or not olmocr_api_key:
                logger.info(f"Skipping olmOCR (enabled={enable_olmocr}, has_key={bool(olmocr_api_key)})")
                continue
        
        methods_tried.append(method_name)
        
        try:
            logger.info(f"Trying {method_name} for table extraction...")
            
            if method_name == "olmocr":
                tables = extract_func(pdf_path, page_num, api_key=olmocr_api_key)
            else:
                tables = extract_func(pdf_path, page_num)
            
            if tables:
                logger.info(f"{method_name} successfully extracted {len(tables)} table(s)")
                return {
                    "success": True,
                    "tables": tables,
                    "method_used": method_name,
                    "methods_tried": methods_tried,
                    "table_count": len(tables),
                    "errors": errors
                }
            else:
                error_msg = f"{method_name} returned no tables"
                logger.warning(error_msg)
                errors.append(error_msg)
                
        except Exception as e:
            error_msg = f"{method_name} failed: {str(e)}"
            logger.warning(error_msg)
            errors.append(error_msg)
            continue
    
    # All methods failed
    return {
        "success": False,
        "tables": [],
        "method_used": None,
        "methods_tried": methods_tried,
        "table_count": 0,
        "errors": errors
    }
```

### Step 2.3: Update API Endpoints (30 minutes)

**File**: `backend/app/main.py`

**Update existing endpoint**:

```python
@app.post("/api/extract-tables-unified")
async def extract_tables_unified(
    file: UploadFile = File(...),
    page: Optional[int] = Query(None, description="Page number (1-indexed)"),
    method: Optional[str] = Query(None, description="Force specific method"),
    enable_olmocr: bool = Query(True, description="Enable olmOCR fallback"),
    olmocr_api_key: Optional[str] = Header(None, alias="X-OlmOCR-API-Key")
):
    """
    Extract tables using unified API with multiple fallback methods
    
    Methods tried in order:
    1. PyMuPDF (fast, rule-based)
    2. Camelot (accurate, specialized)
    3. Tabula (backup, Java-based)
    4. olmOCR (VLM-based, external API) - optional
    
    Headers:
    - X-OlmOCR-API-Key: Optional API key for olmOCR (overrides env var)
    """
    try:
        # Save uploaded file
        pdf_path = save_uploaded_file(file)
        
        # Extract tables
        result = UnifiedExtractor.extract_tables(
            pdf_path=pdf_path,
            page_num=page,
            method=method,
            olmocr_api_key=olmocr_api_key,
            enable_olmocr=enable_olmocr
        )
        
        # Cleanup
        os.remove(pdf_path)
        
        return result
        
    except Exception as e:
        logger.error(f"Error in extract_tables_unified: {e}")
        return {
            "success": False,
            "error": str(e),
            "method_used": None
        }
```

### Step 2.4: Add Configuration Management (30 minutes)

**File**: `backend/app/config.py` (create if doesn't exist)

```python
"""
Configuration management for extraction methods
"""
import os
from typing import Optional
from pydantic import BaseSettings

class Settings(BaseSettings):
    """Application settings"""
    
    # olmOCR configuration
    olmocr_api_key: Optional[str] = None
    olmocr_provider: str = "deepinfra"
    olmocr_enabled: bool = True
    olmocr_timeout: int = 60  # seconds
    olmocr_max_retries: int = 2
    
    # Extraction preferences
    preferred_table_method: Optional[str] = None  # None = try all in order
    preferred_figure_method: Optional[str] = None
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

# Global settings instance
settings = Settings()
```

**Update unified_extraction.py to use settings**:

```python
from app.config import settings

# In extract_tables method:
if not olmocr_api_key:
    olmocr_api_key = settings.olmocr_api_key

if not enable_olmocr:
    enable_olmocr = settings.olmocr_enabled
```

---

## Phase 3: Testing and Validation (2 hours)

### Step 3.1: Unit Tests (1 hour)

**File**: `tests/test_olmocr_extraction.py`

```python
"""
Unit tests for olmOCR extraction
"""
import pytest
import os
from backend.app.api.olmocr_extraction import extract_tables_olmocr, OlmOCRExtractor

@pytest.fixture
def api_key():
    """Get API key from environment"""
    key = os.getenv("OLMOCR_API_KEY")
    if not key:
        pytest.skip("OLMOCR_API_KEY not set")
    return key

@pytest.fixture
def sample_pdf():
    """Path to sample PDF"""
    return "test_samples/Won2024.pdf"

def test_olmocr_extractor_initialization(api_key):
    """Test OlmOCRExtractor initialization"""
    extractor = OlmOCRExtractor(api_key, provider="deepinfra")
    assert extractor.api_key == api_key
    assert extractor.provider == "deepinfra"
    assert "deepinfra" in extractor.endpoints

def test_pdf_page_to_base64(api_key, sample_pdf):
    """Test PDF to base64 conversion"""
    extractor = OlmOCRExtractor(api_key)
    base64_img = extractor.pdf_page_to_base64(sample_pdf, page_num=0)
    
    assert isinstance(base64_img, str)
    assert len(base64_img) > 1000  # Should be substantial
    
def test_extract_tables_single_page(api_key, sample_pdf):
    """Test table extraction from single page"""
    tables = extract_tables_olmocr(sample_pdf, page_num=4, api_key=api_key)
    
    assert isinstance(tables, list)
    assert len(tables) >= 1  # Should find at least one table
    
    # Check table structure
    table = tables[0]
    assert "table_index" in table
    assert "page" in table
    assert "markdown" in table
    assert "rows" in table
    assert "cols" in table
    assert "extraction_method" in table
    assert table["extraction_method"] == "olmocr_vlm"

def test_extract_tables_no_api_key(sample_pdf):
    """Test that extraction fails without API key"""
    with pytest.raises(ValueError, match="API key required"):
        extract_tables_olmocr(sample_pdf, page_num=4, api_key=None)

def test_parse_tables_from_markdown(api_key):
    """Test markdown table parsing"""
    markdown = """
    # Sample Document
    
    | Header 1 | Header 2 | Header 3 |
    |----------|----------|----------|
    | Data 1   | Data 2   | Data 3   |
    | Data 4   | Data 5   | Data 6   |
    
    Some text after the table.
    """
    
    extractor = OlmOCRExtractor(api_key)
    tables = extractor.parse_tables_from_markdown(markdown, page_num=0)
    
    assert len(tables) == 1
    assert tables[0]["rows"] == 3  # Header + 2 data rows
    assert tables[0]["cols"] == 3
```

**Run tests**:
```bash
cd /home/ubuntu/clinical-study-extraction-app
pytest tests/test_olmocr_extraction.py -v
```

### Step 3.2: Integration Tests (30 minutes)

**File**: `tests/test_unified_extraction_with_olmocr.py`

```python
"""
Integration tests for unified extraction with olmOCR
"""
import pytest
import os
from backend.app.api.unified_extraction import UnifiedExtractor

@pytest.fixture
def api_key():
    key = os.getenv("OLMOCR_API_KEY")
    if not key:
        pytest.skip("OLMOCR_API_KEY not set")
    return key

@pytest.fixture
def sample_pdf():
    return "test_samples/Won2024.pdf"

def test_unified_extraction_with_olmocr_fallback(api_key, sample_pdf):
    """Test that olmOCR is used as fallback"""
    result = UnifiedExtractor.extract_tables(
        sample_pdf,
        page_num=4,
        olmocr_api_key=api_key,
        enable_olmocr=True
    )
    
    assert result["success"] == True
    assert result["method_used"] in ["pymupdf", "camelot", "tabula", "olmocr"]
    assert len(result["tables"]) >= 1
    assert "methods_tried" in result

def test_unified_extraction_olmocr_disabled(sample_pdf):
    """Test that olmOCR can be disabled"""
    result = UnifiedExtractor.extract_tables(
        sample_pdf,
        page_num=4,
        enable_olmocr=False
    )
    
    assert "olmocr" not in result.get("methods_tried", [])

def test_unified_extraction_force_olmocr(api_key, sample_pdf):
    """Test forcing olmOCR method"""
    result = UnifiedExtractor.extract_tables(
        sample_pdf,
        page_num=4,
        method="olmocr",
        olmocr_api_key=api_key
    )
    
    assert result["success"] == True
    assert result["method_used"] == "olmocr"
```

### Step 3.3: Comparison Testing (30 minutes)

**File**: `tests/compare_extraction_methods.py`

```python
"""
Compare all extraction methods including olmOCR
"""
import os
from backend.app.api.pymupdf_table_extraction import extract_tables_pymupdf
from backend.app.api.camelot_table_extraction import extract_tables_camelot
from backend.app.api.tabula_table_extraction import extract_tables_tabula
from backend.app.api.olmocr_extraction import extract_tables_olmocr

pdf_path = "test_samples/Won2024.pdf"
page_num = 4
api_key = os.getenv("OLMOCR_API_KEY")

print("=" * 80)
print("EXTRACTION METHOD COMPARISON")
print("=" * 80)

methods = [
    ("PyMuPDF", lambda: extract_tables_pymupdf(pdf_path, page_num)),
    ("Camelot", lambda: extract_tables_camelot(pdf_path, page_num)),
    ("Tabula", lambda: extract_tables_tabula(pdf_path, page_num)),
    ("olmOCR", lambda: extract_tables_olmocr(pdf_path, page_num, api_key=api_key))
]

results = {}

for method_name, extract_func in methods:
    print(f"\n{method_name}:")
    try:
        import time
        start = time.time()
        tables = extract_func()
        duration = time.time() - start
        
        results[method_name] = {
            "success": True,
            "table_count": len(tables),
            "duration": duration,
            "tables": tables
        }
        
        print(f"  ✅ Success")
        print(f"  Tables: {len(tables)}")
        print(f"  Duration: {duration:.2f}s")
        
        if tables:
            table = tables[0]
            print(f"  First table: {table.get('rows', 'N/A')} rows × {table.get('cols', 'N/A')} cols")
            
    except Exception as e:
        results[method_name] = {
            "success": False,
            "error": str(e)
        }
        print(f"  ❌ Failed: {e}")

print("\n" + "=" * 80)
print("SUMMARY")
print("=" * 80)

for method_name, result in results.items():
    status = "✅" if result["success"] else "❌"
    print(f"{status} {method_name}: {result.get('table_count', 0)} tables in {result.get('duration', 0):.2f}s")
```

---

## Phase 4: Documentation and Deployment (1 hour)

### Step 4.1: Update API Documentation (20 minutes)

**File**: `backend/README.md`

Add section:

```markdown
## olmOCR Integration

### Overview
olmOCR is a vision language model (VLM) based extraction method that provides state-of-the-art accuracy for complex PDFs. It's integrated as a fourth fallback method in the unified extraction API.

### Configuration

Set environment variables in `.env`:

```bash
OLMOCR_API_KEY=your_deepinfra_api_key
OLMOCR_PROVIDER=deepinfra
OLMOCR_ENABLED=true
```

### Usage

#### Python API
```python
from backend.app.api.olmocr_extraction import extract_tables_olmocr

tables = extract_tables_olmocr(
    pdf_path="document.pdf",
    page_num=4,
    api_key="your_api_key"
)
```

#### REST API
```bash
# With API key in header
curl -X POST "http://localhost:8000/api/extract-tables-unified?page=4" \
  -H "X-OlmOCR-API-Key: your_api_key" \
  -F "file=@document.pdf"

# Disable olmOCR fallback
curl -X POST "http://localhost:8000/api/extract-tables-unified?page=4&enable_olmocr=false" \
  -F "file=@document.pdf"

# Force olmOCR method
curl -X POST "http://localhost:8000/api/extract-tables-unified?page=4&method=olmocr" \
  -H "X-OlmOCR-API-Key: your_api_key" \
  -F "file=@document.pdf"
```

### Cost
- ~$0.0023 per 10-page document
- ~$0.23 per 100 documents
- Free tier: 100 requests/day

### Performance
- Latency: 2-5 seconds per page
- Used only as fallback when other methods fail
- Can be disabled via `enable_olmocr=false`
```

### Step 4.2: Update Main Documentation (20 minutes)

**File**: `ALTERNATIVE_EXTRACTION_METHODS.md`

Add olmOCR section:

```markdown
### 4. olmOCR (VLM-based)

**Library**: External API (DeepInfra/Parasail/Cirrascale)

**Strengths**:
- State-of-the-art VLM-based extraction
- Handles complex layouts
- Supports equations and handwriting
- Active development (Nov 2025)

**Use Cases**:
- Complex multi-column documents
- Scanned PDFs
- When highest accuracy is needed
- Fallback when other methods fail

**Test Results** (Won2024.pdf, page 4):
- ✅ Extracted 1 table
- ✅ High accuracy
- ⚠️ Slower (3-5 seconds per page)
- ⚠️ Requires API key

**Example Usage**:
```python
from backend.app.api.olmocr_extraction import extract_tables_olmocr

tables = extract_tables_olmocr(pdf_path, page_num=4, api_key=api_key)
```
```

### Step 4.3: Create User Guide (20 minutes)

**File**: `docs/OLMOCR_SETUP_GUIDE.md`

```markdown
# olmOCR Setup Guide

## Quick Start

### 1. Get API Key

1. Go to https://deepinfra.com
2. Sign up for free account
3. Generate API key
4. Copy API key

### 2. Configure

Add to `backend/.env`:

```bash
OLMOCR_API_KEY=your_api_key_here
OLMOCR_ENABLED=true
```

### 3. Test

```bash
python3.11 test_olmocr_module.py
```

### 4. Use

olmOCR will automatically be used as a fallback when other methods fail.

## FAQ

**Q: Do I need a GPU?**  
A: No, we use external inference providers.

**Q: How much does it cost?**  
A: ~$0.0023 per 10-page document. Free tier: 100 requests/day.

**Q: Can I disable olmOCR?**  
A: Yes, set `OLMOCR_ENABLED=false` or use `enable_olmocr=false` in API calls.

**Q: Which provider should I use?**  
A: DeepInfra is recommended (good balance of cost and availability).

**Q: What if the API is down?**  
A: The system will automatically fall back to other methods (PyMuPDF, Camelot, Tabula).
```

---

## Phase 5: Deployment and Monitoring (30 minutes)

### Step 5.1: Update Docker Configuration (15 minutes)

**File**: `backend/Dockerfile`

No changes needed! All dependencies already available.

### Step 5.2: Add Monitoring (15 minutes)

**File**: `backend/app/api/olmocr_extraction.py`

Add logging and metrics:

```python
import logging
import time

logger = logging.getLogger(__name__)

class OlmOCRExtractor:
    def extract_via_api(self, pdf_path: str, page_num: int, task: str = "tables") -> str:
        """Call olmOCR API with monitoring"""
        start_time = time.time()
        
        try:
            # ... existing code ...
            
            response = requests.post(url, headers=headers, json=payload, timeout=60)
            response.raise_for_status()
            
            duration = time.time() - start_time
            
            # Log metrics
            logger.info(f"olmOCR API call successful: page={page_num+1}, duration={duration:.2f}s")
            
            # Could add metrics to monitoring system here
            # metrics.record("olmocr.api.duration", duration)
            # metrics.increment("olmocr.api.success")
            
            return result["choices"][0]["message"]["content"]
            
        except requests.exceptions.Timeout:
            duration = time.time() - start_time
            logger.error(f"olmOCR API timeout: page={page_num+1}, duration={duration:.2f}s")
            # metrics.increment("olmocr.api.timeout")
            raise
            
        except requests.exceptions.HTTPError as e:
            duration = time.time() - start_time
            logger.error(f"olmOCR API HTTP error: status={e.response.status_code}, duration={duration:.2f}s")
            # metrics.increment("olmocr.api.http_error")
            raise
            
        except Exception as e:
            duration = time.time() - start_time
            logger.error(f"olmOCR API unexpected error: {e}, duration={duration:.2f}s")
            # metrics.increment("olmocr.api.error")
            raise
```

---

## Implementation Checklist

### Phase 1: Setup ✓
- [ ] Sign up for DeepInfra API
- [ ] Get API key
- [ ] Configure environment variables
- [ ] Update .gitignore
- [ ] Create test directory

### Phase 2: Core Implementation ✓
- [ ] Create olmOCR extraction module
- [ ] Test olmOCR module independently
- [ ] Update unified extraction API
- [ ] Update API endpoints
- [ ] Add configuration management

### Phase 3: Testing ✓
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Run comparison tests
- [ ] Validate accuracy vs. existing methods
- [ ] Test error handling

### Phase 4: Documentation ✓
- [ ] Update API documentation
- [ ] Update main documentation
- [ ] Create user guide
- [ ] Document configuration options

### Phase 5: Deployment ✓
- [ ] Update Docker configuration (if needed)
- [ ] Add monitoring and logging
- [ ] Deploy to production
- [ ] Monitor performance

---

## Rollback Plan

If issues arise, olmOCR can be easily disabled:

### Option 1: Environment Variable
```bash
# In .env
OLMOCR_ENABLED=false
```

### Option 2: API Parameter
```bash
curl -X POST "http://localhost:8000/api/extract-tables-unified?enable_olmocr=false" \
  -F "file=@document.pdf"
```

### Option 3: Remove from Methods List
```python
# In unified_extraction.py
TABLE_METHODS = [
    ("pymupdf", extract_tables_pymupdf),
    ("camelot", extract_tables_camelot),
    ("tabula", extract_tables_tabula),
    # ("olmocr", extract_tables_olmocr)  # Commented out
]
```

---

## Success Criteria

### Functional Requirements
- ✅ olmOCR successfully extracts tables from Won2024.pdf
- ✅ olmOCR is used as fallback when other methods fail
- ✅ olmOCR can be disabled via configuration
- ✅ API key can be provided via environment or header
- ✅ Errors are handled gracefully

### Performance Requirements
- ✅ Latency < 10 seconds per page
- ✅ Cost < $0.01 per document
- ✅ Success rate > 90% for complex PDFs

### Quality Requirements
- ✅ Accuracy ≥ Camelot (98.87%)
- ✅ All tests passing
- ✅ Comprehensive documentation
- ✅ Proper error handling and logging

---

## Timeline

### Day 1 (4-5 hours)
- **Morning** (2 hours):
  - Phase 1: Setup and prerequisites
  - Phase 2: Start core implementation
- **Afternoon** (2-3 hours):
  - Phase 2: Complete core implementation
  - Phase 3: Start testing

### Day 2 (2-3 hours)
- **Morning** (1-2 hours):
  - Phase 3: Complete testing
  - Phase 4: Documentation
- **Afternoon** (1 hour):
  - Phase 5: Deployment
  - Final validation

**Total**: 6-8 hours over 1-2 days

---

## Risk Mitigation

### Risk 1: API Key Not Available
**Mitigation**: olmOCR is optional fallback, system works without it

### Risk 2: API Rate Limits
**Mitigation**: Free tier (100 req/day) sufficient for fallback usage

### Risk 3: API Downtime
**Mitigation**: Automatic fallback to other methods (PyMuPDF, Camelot, Tabula)

### Risk 4: Higher Cost Than Expected
**Mitigation**: Can be disabled via configuration, monitor usage

### Risk 5: Lower Accuracy Than Expected
**Mitigation**: Only used as fallback, other methods tried first

---

## Next Steps

1. **Review this plan** with team
2. **Get approval** for DeepInfra API usage
3. **Schedule implementation** (1-2 days)
4. **Begin Phase 1** (setup)
5. **Iterate through phases**
6. **Deploy and monitor**

---

## Support and Resources

- **olmOCR GitHub**: https://github.com/allenai/olmocr
- **DeepInfra Docs**: https://deepinfra.com/docs
- **Implementation Questions**: Reference ALLEN_AI_TECHNICAL_REQUIREMENTS.md
- **Troubleshooting**: Check logs in `backend/logs/`

---

**Ready to implement? Let's get started!** 🚀
