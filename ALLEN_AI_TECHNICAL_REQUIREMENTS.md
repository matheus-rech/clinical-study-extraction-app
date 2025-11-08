# Allen AI Integration - Technical Requirements Analysis

## Executive Summary

This document analyzes the technical requirements, dependencies, and integration challenges for adding Allen AI document understanding as a fourth fallback extraction method.

**Recommendation**: **olmOCR with External Inference Provider** (DeepInfra or Parasail)

---

## Option 1: olmOCR with External Inference Provider (RECOMMENDED)

### Architecture Overview

```
User Request → Unified API → Try Methods in Order:
  1. PyMuPDF (fast, local)
  2. Camelot (accurate, local)
  3. Tabula (backup, local)
  4. olmOCR (VLM-based, external API) ← NEW
```

### Technical Requirements

#### Dependencies
```python
# Python packages
pip install requests  # For API calls (already installed)
pip install markdown  # For parsing markdown output (already installed)

# No additional system dependencies
# No GPU required (using external provider)
# No large model downloads
```

#### API Integration

**Provider Options**:

| Provider | Cost (Input/Output per 1M tokens) | Endpoint | API Key Required |
|----------|-----------------------------------|----------|------------------|
| **DeepInfra** | $0.09 / $0.19 | `https://api.deepinfra.com/v1/openai` | Yes (free tier available) |
| **Parasail** | $0.10 / $0.20 | `https://api.parasail.io/v1` | Yes |
| **Cirrascale** | $0.07 / $0.15 | `https://ai2endpoints.cirrascale.ai/api` | Yes |

**Recommended**: **DeepInfra** (good balance of cost and availability)

#### API Request Format

```python
import requests
import base64

# Prepare request
url = "https://api.deepinfra.com/v1/openai/chat/completions"
headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json"
}

# Convert PDF page to image
pdf_image_base64 = convert_pdf_page_to_image(pdf_path, page_num)

payload = {
    "model": "allenai/olmOCR-2-7B-1025",
    "messages": [
        {
            "role": "user",
            "content": [
                {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{pdf_image_base64}"}},
                {"type": "text", "text": "Extract tables and figures from this page in markdown format."}
            ]
        }
    ],
    "max_tokens": 4096,
    "temperature": 0.0  # Deterministic output
}

response = requests.post(url, headers=headers, json=payload)
markdown_output = response.json()["choices"][0]["message"]["content"]
```

#### Output Processing

**olmOCR Output**: Markdown text with tables and figures

**Processing Steps**:
1. Parse markdown to identify tables (look for `|` delimiters)
2. Extract table content
3. Identify figure references (look for `Figure X.` patterns)
4. Convert markdown tables to JSON format
5. Return in unified API format

### Integration Steps

#### Step 1: Create olmOCR Extraction Module (2-3 hours)

**File**: `backend/app/api/olmocr_extraction.py`

```python
"""
olmOCR-based extraction using external inference provider
"""
import requests
import base64
import io
import re
from typing import List, Dict, Any, Optional
from PIL import Image
import fitz  # PyMuPDF for PDF to image conversion
import logging

logger = logging.getLogger(__name__)

class OlmOCRExtractor:
    """Extract tables and figures using olmOCR VLM via external API"""
    
    def __init__(self, api_key: str, provider: str = "deepinfra"):
        self.api_key = api_key
        self.provider = provider
        self.endpoints = {
            "deepinfra": "https://api.deepinfra.com/v1/openai/chat/completions",
            "parasail": "https://api.parasail.io/v1/chat/completions",
            "cirrascale": "https://ai2endpoints.cirrascale.ai/api/chat/completions"
        }
        self.models = {
            "deepinfra": "allenai/olmOCR-2-7B-1025",
            "parasail": "allenai/olmOCR-2-7B-1025",
            "cirrascale": "olmOCR-2-7B-1025"
        }
    
    def pdf_page_to_base64(self, pdf_path: str, page_num: int, dpi: int = 150) -> str:
        """Convert PDF page to base64 encoded image"""
        doc = fitz.open(pdf_path)
        page = doc[page_num]
        
        # Render page to image
        mat = fitz.Matrix(dpi/72, dpi/72)
        pix = page.get_pixmap(matrix=mat)
        
        # Convert to PIL Image
        img_data = pix.tobytes("png")
        img = Image.open(io.BytesIO(img_data))
        
        # Convert to base64
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        img_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
        
        doc.close()
        return img_base64
    
    def extract_via_api(self, pdf_path: str, page_num: int, task: str = "tables") -> str:
        """Call olmOCR API to extract content"""
        # Convert PDF page to image
        img_base64 = self.pdf_page_to_base64(pdf_path, page_num)
        
        # Prepare prompt based on task
        prompts = {
            "tables": "Extract all tables from this page in markdown format. Preserve table structure and content accurately.",
            "figures": "Extract all figures and their captions from this page. Describe what each figure shows.",
            "all": "Extract all content from this page in markdown format, including tables, figures, and text."
        }
        
        # API request
        url = self.endpoints[self.provider]
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": self.models[self.provider],
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{img_base64}"}},
                        {"type": "text", "text": prompts.get(task, prompts["all"])}
                    ]
                }
            ],
            "max_tokens": 4096,
            "temperature": 0.0
        }
        
        try:
            response = requests.post(url, headers=headers, json=payload, timeout=60)
            response.raise_for_status()
            
            result = response.json()
            markdown_output = result["choices"][0]["message"]["content"]
            
            logger.info(f"olmOCR extraction successful for page {page_num + 1}")
            return markdown_output
            
        except Exception as e:
            logger.error(f"olmOCR API error: {e}")
            raise
    
    def parse_tables_from_markdown(self, markdown: str, page_num: int) -> List[Dict[str, Any]]:
        """Parse markdown tables into structured format"""
        tables = []
        
        # Find markdown tables (lines with | delimiters)
        lines = markdown.split('\n')
        current_table = []
        in_table = False
        
        for line in lines:
            if '|' in line:
                if not in_table:
                    in_table = True
                    current_table = []
                current_table.append(line)
            else:
                if in_table and current_table:
                    # End of table, process it
                    table_markdown = '\n'.join(current_table)
                    
                    # Parse table dimensions
                    rows = [r for r in current_table if r.strip() and not r.strip().startswith('|---')]
                    cols = len([c for c in rows[0].split('|') if c.strip()]) if rows else 0
                    
                    tables.append({
                        "table_index": len(tables),
                        "page": page_num + 1,
                        "markdown": table_markdown,
                        "rows": len(rows),
                        "cols": cols,
                        "extraction_method": "olmocr_vlm"
                    })
                    
                    current_table = []
                    in_table = False
        
        # Handle table at end of markdown
        if in_table and current_table:
            table_markdown = '\n'.join(current_table)
            rows = [r for r in current_table if r.strip() and not r.strip().startswith('|---')]
            cols = len([c for c in rows[0].split('|') if c.strip()]) if rows else 0
            
            tables.append({
                "table_index": len(tables),
                "page": page_num + 1,
                "markdown": table_markdown,
                "rows": len(rows),
                "cols": cols,
                "extraction_method": "olmocr_vlm"
            })
        
        return tables
    
    def extract_tables(self, pdf_path: str, page_num: Optional[int] = None) -> List[Dict[str, Any]]:
        """Extract tables from PDF using olmOCR"""
        all_tables = []
        
        if page_num is not None:
            # Extract from specific page
            markdown = self.extract_via_api(pdf_path, page_num, task="tables")
            tables = self.parse_tables_from_markdown(markdown, page_num)
            all_tables.extend(tables)
        else:
            # Extract from all pages
            doc = fitz.open(pdf_path)
            for page_idx in range(len(doc)):
                try:
                    markdown = self.extract_via_api(pdf_path, page_idx, task="tables")
                    tables = self.parse_tables_from_markdown(markdown, page_idx)
                    all_tables.extend(tables)
                except Exception as e:
                    logger.warning(f"Failed to extract from page {page_idx + 1}: {e}")
            doc.close()
        
        return all_tables


def extract_tables_olmocr(pdf_path: str, page_num: Optional[int] = None, 
                          api_key: Optional[str] = None, provider: str = "deepinfra") -> List[Dict[str, Any]]:
    """
    Main function to extract tables using olmOCR
    
    Args:
        pdf_path: Path to PDF file
        page_num: Specific page number (1-indexed), or None for all pages
        api_key: API key for inference provider
        provider: Inference provider ('deepinfra', 'parasail', 'cirrascale')
        
    Returns:
        List of extracted tables
    """
    if not api_key:
        raise ValueError("API key required for olmOCR extraction")
    
    extractor = OlmOCRExtractor(api_key, provider)
    
    # Convert to 0-indexed if page_num provided
    page_idx = (page_num - 1) if page_num is not None else None
    
    return extractor.extract_tables(pdf_path, page_idx)
```

#### Step 2: Update Unified Extraction API (1 hour)

**File**: `backend/app/api/unified_extraction.py`

```python
# Add import
from app.api.olmocr_extraction import extract_tables_olmocr

class UnifiedExtractor:
    # Update TABLE_METHODS
    TABLE_METHODS = [
        ("pymupdf", extract_tables_pymupdf),
        ("camelot", extract_tables_camelot),
        ("tabula", extract_tables_tabula),
        ("olmocr", extract_tables_olmocr)  # NEW: Add as fourth method
    ]
    
    @staticmethod
    def extract_tables(pdf_path: str, page_num: Optional[int] = None, 
                      method: Optional[str] = None,
                      olmocr_api_key: Optional[str] = None) -> Dict[str, Any]:
        """Extract tables with olmOCR as fallback"""
        
        # Try each method in order
        for method_name, extract_func in UnifiedExtractor.TABLE_METHODS:
            try:
                # Skip olmOCR if no API key provided
                if method_name == "olmocr" and not olmocr_api_key:
                    continue
                
                # Call extraction method
                if method_name == "olmocr":
                    tables = extract_func(pdf_path, page_num, api_key=olmocr_api_key)
                else:
                    tables = extract_func(pdf_path, page_num)
                
                if tables:
                    return {
                        "success": True,
                        "tables": tables,
                        "method_used": method_name,
                        "table_count": len(tables)
                    }
            except Exception as e:
                logger.warning(f"{method_name} failed: {e}")
                continue
        
        return {"success": False, "tables": [], "method_used": None}
```

#### Step 3: Add API Endpoint (30 minutes)

**File**: `backend/app/main.py`

```python
@app.post("/api/extract-tables-unified")
async def extract_tables_unified(
    file: UploadFile = File(...),
    page: Optional[int] = None,
    method: Optional[str] = None,
    olmocr_api_key: Optional[str] = Header(None, alias="X-OlmOCR-API-Key")
):
    """Extract tables with optional olmOCR fallback"""
    # Save uploaded file
    pdf_path = save_uploaded_file(file)
    
    # Extract tables
    result = UnifiedExtractor.extract_tables(
        pdf_path, 
        page_num=page, 
        method=method,
        olmocr_api_key=olmocr_api_key
    )
    
    return result
```

#### Step 4: Environment Configuration (15 minutes)

**File**: `backend/.env`

```bash
# Optional: olmOCR API key (can also be passed per request)
OLMOCR_API_KEY=your_deepinfra_api_key_here
OLMOCR_PROVIDER=deepinfra  # or 'parasail', 'cirrascale'
```

#### Step 5: Testing (2 hours)

**File**: `test_olmocr_integration.py`

```python
import os
from backend.app.api.olmocr_extraction import extract_tables_olmocr

# Test with Won2024.pdf
pdf_path = "test_samples/Won2024.pdf"
api_key = os.getenv("OLMOCR_API_KEY")

# Test single page
tables = extract_tables_olmocr(pdf_path, page_num=4, api_key=api_key)
print(f"Extracted {len(tables)} tables from page 4")

# Compare with existing methods
from backend.app.api.camelot_table_extraction import extract_tables_camelot
camelot_tables = extract_tables_camelot(pdf_path, page_num=4)

print(f"\nComparison:")
print(f"  olmOCR: {len(tables)} tables")
print(f"  Camelot: {len(camelot_tables)} tables")
```

### Cost Analysis

**Per Request Cost** (Won2024.pdf, 10 pages):

Assuming average of 2000 tokens per page (input + output):
- **Input**: 10 pages × 1500 tokens = 15,000 tokens
- **Output**: 10 pages × 500 tokens = 5,000 tokens
- **Total**: 20,000 tokens = 0.02M tokens

**Cost per document** (DeepInfra):
- Input: 0.015M × $0.09 = $0.00135
- Output: 0.005M × $0.19 = $0.00095
- **Total**: ~$0.0023 per document (~$0.23 per 100 documents)

**Very affordable for fallback method!**

### Performance Considerations

**Latency**:
- API call: ~2-5 seconds per page
- Total for 10-page document: ~20-50 seconds
- **Acceptable for fallback method** (only used when other methods fail)

**Rate Limits** (DeepInfra):
- Free tier: 100 requests/day
- Paid tier: Higher limits
- **Sufficient for fallback usage**

### Error Handling

```python
def extract_with_olmocr_fallback(pdf_path, page_num):
    try:
        # Try olmOCR
        tables = extract_tables_olmocr(pdf_path, page_num, api_key=api_key)
        if tables:
            return {"success": True, "tables": tables, "method": "olmocr"}
    except requests.exceptions.Timeout:
        logger.warning("olmOCR timeout, falling back")
    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 429:
            logger.warning("olmOCR rate limit exceeded")
        else:
            logger.error(f"olmOCR HTTP error: {e}")
    except Exception as e:
        logger.error(f"olmOCR unexpected error: {e}")
    
    # Fallback to existing methods
    return extract_with_existing_methods(pdf_path, page_num)
```

---

## Option 2: pdffigures2 (Alternative - Not Recommended)

### Technical Requirements

#### Dependencies
```bash
# System requirements
- Java 8+
- sbt (Scala Build Tool)
- 2GB disk space

# Build
git clone https://github.com/allenai/pdffigures2.git
cd pdffigures2
sbt assembly
```

#### Integration Challenges

1. **Language Barrier**: Scala/JVM, not Python
   - Requires subprocess calls from Python
   - Complex error handling
   - Difficult to debug

2. **Maintenance Status**: Last commit 2 years ago
   - No active development
   - Potential compatibility issues

3. **Domain Mismatch**: Focused on CS papers
   - May not work well for clinical studies
   - Different table/figure formats

4. **Build Complexity**: Requires sbt
   - Additional build step
   - Larger Docker image
   - More deployment complexity

### Integration Effort: **High** (8-12 hours)

**Not recommended** due to language barrier and maintenance status.

---

## Effort Estimates Summary

### Option 1: olmOCR with External API (RECOMMENDED)

| Task | Estimated Time | Complexity |
|------|----------------|------------|
| Create olmOCR extraction module | 2-3 hours | Medium |
| Update unified API | 1 hour | Low |
| Add API endpoint | 30 minutes | Low |
| Environment configuration | 15 minutes | Low |
| Testing and validation | 2 hours | Medium |
| Documentation | 1 hour | Low |
| **Total** | **6-8 hours** | **Medium** |

### Option 2: pdffigures2 (NOT RECOMMENDED)

| Task | Estimated Time | Complexity |
|------|----------------|------------|
| Install Java/sbt | 1 hour | Medium |
| Build pdffigures2 | 1 hour | Medium |
| Create Python wrapper | 3-4 hours | High |
| Update unified API | 1 hour | Low |
| Testing and validation | 2-3 hours | High |
| Documentation | 1 hour | Low |
| **Total** | **9-12 hours** | **High** |

---

## Recommendation

**Implement Option 1: olmOCR with External Inference Provider**

**Rationale**:
1. ✅ **Lower effort** (6-8 hours vs. 9-12 hours)
2. ✅ **Pure Python** (no language barrier)
3. ✅ **No GPU required** (external provider)
4. ✅ **State-of-the-art accuracy** (VLM-based)
5. ✅ **Active development** (Nov 2025 release)
6. ✅ **Low cost** (~$0.0023 per document)
7. ✅ **Easy to test** (just need API key)

**Next Steps**:
1. Sign up for DeepInfra API key (free tier available)
2. Implement olmOCR extraction module (2-3 hours)
3. Test on Won2024.pdf (1 hour)
4. Compare accuracy vs. existing methods (1 hour)
5. Integrate into unified API (1-2 hours)
6. Document and deploy (1 hour)

**Total Implementation Time**: **6-8 hours**
