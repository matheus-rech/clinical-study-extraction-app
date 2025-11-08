# Allen AI Integration - Final Report & Recommendations

## Executive Summary

This report provides a comprehensive analysis of three Allen AI document understanding approaches for integration as a fourth fallback extraction method in the clinical study extraction application.

**Date**: November 8, 2025  
**Current Status**: 3 extraction methods implemented (PyMuPDF, Camelot, Tabula)  
**Goal**: Add Allen AI method as 4th fallback

---

## Options Evaluated

### Option 1: olmOCR (VLM-based OCR)
### Option 2: pdffigures2 (Rule-based Figure/Table Extraction)  
### Option 3: scholarphi (Interactive PDF Reader - NOT suitable for extraction)

---

## Detailed Comparison

| Criterion | olmOCR | pdffigures2 | scholarphi |
|-----------|--------|-------------|------------|
| **Type** | Vision Language Model | Rule-based extraction | Interactive UI |
| **Purpose** | OCR + Structure extraction | Figure/Table extraction | PDF reading interface |
| **Language** | Python | Scala/JVM | TypeScript/Python |
| **GPU Required** | Yes (15GB+) or External API | No | No |
| **Cost** | ~$0.0023/doc (external API) | Free (local) | Free (local) |
| **Accuracy** | ⭐⭐⭐⭐⭐ (State-of-the-art) | ⭐⭐⭐⭐ (Good) | N/A (not extraction tool) |
| **Speed** | ⭐⭐ (2-5s/page) | ⭐⭐⭐⭐ (Fast) | N/A |
| **Maintenance** | ✅ Active (Nov 2025) | ⚠️ Maintenance mode (2 years) | ✅ Active |
| **Integration Effort** | 6-8 hours | 8-12 hours | Not applicable |
| **Deployment Complexity** | Low (external API) / High (local GPU) | Medium (JVM dependency) | N/A |
| **Best For** | Complex layouts, scanned PDFs | Scientific papers (CS domain) | Frontend visualization |
| **Suitable for Clinical Studies** | ✅ Yes | ⚠️ Maybe (CS-focused) | ❌ No (UI only) |

---

## Option 1: olmOCR - Detailed Analysis

### What It Is
- **Vision Language Model** (7B parameters) for document OCR
- Converts PDFs to **Markdown** with preserved structure
- Handles equations, tables, handwriting, multi-column layouts
- Released November 2025 (very recent!)

### Architecture Options

#### A. Local GPU Deployment
```
PDF → olmOCR (local GPU) → Markdown → Parse → JSON
```

**Requirements**:
- NVIDIA GPU with 15+ GB VRAM
- 30GB disk space
- PyTorch with CUDA 12.8
- sglang for inference

**Pros**:
- ✅ No external dependencies
- ✅ No API costs
- ✅ Full control

**Cons**:
- ❌ Requires expensive GPU hardware
- ❌ Large model downloads
- ❌ Higher deployment complexity

**Effort**: 10-12 hours

#### B. External API Deployment (RECOMMENDED)
```
PDF → Convert to Image → DeepInfra API → Markdown → Parse → JSON
```

**Requirements**:
- DeepInfra API key (free tier: 100 req/day)
- requests library (already installed)
- PIL/Pillow (already installed)
- PyMuPDF (already installed)

**Pros**:
- ✅ No GPU required
- ✅ Easy integration (6-8 hours)
- ✅ Low cost (~$0.0023/doc)
- ✅ State-of-the-art accuracy

**Cons**:
- ❌ External API dependency
- ❌ Network latency (2-5s/page)
- ❌ Requires API key management

**Effort**: 6-8 hours

### Implementation Steps (External API)

1. **Setup** (30 min)
   - Sign up for DeepInfra
   - Get API key
   - Configure environment

2. **Core Implementation** (3-4 hours)
   - Create `olmocr_extraction.py`
   - Implement PDF → Image conversion
   - Implement API calling logic
   - Implement Markdown → JSON parsing

3. **Integration** (1 hour)
   - Update `unified_extraction.py`
   - Add olmOCR as 4th method
   - Update API endpoints

4. **Testing** (2 hours)
   - Unit tests
   - Integration tests
   - Comparison with existing methods

5. **Documentation** (1 hour)
   - API documentation
   - User guide
   - Configuration guide

**Total**: 6-8 hours

### Cost Analysis

**Per Document** (10 pages):
- Input tokens: 15,000 (~$0.00135)
- Output tokens: 5,000 (~$0.00095)
- **Total**: ~$0.0023 per document

**Per Month** (1000 documents):
- **Total**: ~$2.30/month

**Very affordable for fallback usage!**

### Code Example

```python
import requests
import base64
from PIL import Image
import fitz  # PyMuPDF

class OlmOCRExtractor:
    def __init__(self, api_key):
        self.api_key = api_key
        self.endpoint = "https://api.deepinfra.com/v1/openai/chat/completions"
    
    def pdf_page_to_base64(self, pdf_path, page_num):
        doc = fitz.open(pdf_path)
        page = doc[page_num]
        pix = page.get_pixmap(matrix=fitz.Matrix(150/72, 150/72))
        img_data = pix.tobytes("png")
        return base64.b64encode(img_data).decode('utf-8')
    
    def extract_tables(self, pdf_path, page_num):
        img_base64 = self.pdf_page_to_base64(pdf_path, page_num)
        
        response = requests.post(
            self.endpoint,
            headers={"Authorization": f"Bearer {self.api_key}"},
            json={
                "model": "allenai/olmOCR-2-7B-1025",
                "messages": [{
                    "role": "user",
                    "content": [
                        {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{img_base64}"}},
                        {"type": "text", "text": "Extract all tables in markdown format."}
                    ]
                }],
                "temperature": 0.0
            }
        )
        
        markdown = response.json()["choices"][0]["message"]["content"]
        return self.parse_markdown_tables(markdown)
```

---

## Option 2: pdffigures2 - Detailed Analysis

### What It Is
- **Rule-based** figure and table extraction tool
- Written in **Scala** (JVM-based)
- Specialized for **scientific papers** (computer science domain)
- Returns structured JSON + rendered images

### Architecture
```
PDF → pdffigures2 (Java/Scala) → JSON + Images → Python wrapper → Unified API
```

### Requirements
- Java 8+ ✅ (already installed)
- sbt (Scala Build Tool) ⚠️ (installation issues in sandbox)
- 2GB disk space
- No GPU required ✅

### Pros
- ✅ No GPU required
- ✅ No API costs (runs locally)
- ✅ Specialized for figures/tables
- ✅ Deterministic (rule-based)
- ✅ Returns both JSON metadata and rendered images

### Cons
- ❌ **Scala/JVM dependency** (language barrier)
- ❌ **Maintenance mode** (last commit 2 years ago)
- ❌ **Focused on CS papers** (may not work well for clinical studies)
- ❌ **Build complexity** (sbt required, file system issues encountered)
- ❌ Requires subprocess calls from Python (error handling complexity)

### Implementation Steps

1. **Installation** (2-3 hours)
   - Install sbt (if not working, use Docker)
   - Clone pdffigures2 repo
   - Build JAR with `sbt assembly`
   - Troubleshoot build issues

2. **Python Wrapper** (3-4 hours)
   - Create `pdffigures2_extraction.py`
   - Implement subprocess calling
   - Parse JSON output
   - Handle errors and timeouts
   - Convert to unified format

3. **Integration** (1 hour)
   - Update `unified_extraction.py`
   - Add pdffigures2 as 4th method

4. **Testing** (2-3 hours)
   - Test on Won2024.pdf
   - Compare with existing methods
   - Test error handling
   - Test on various PDF types

5. **Documentation** (1 hour)
   - Installation guide
   - Usage documentation

**Total**: 9-12 hours

### Build Issues Encountered

During implementation attempt, encountered:
```
java.io.IOException: User limit of inotify instances reached or too many open files
```

**Solutions**:
1. Use Docker container with pre-built JAR
2. Download pre-compiled JAR (if available)
3. Build in different environment

### Code Example

```python
import subprocess
import json
import os

class PDFFigures2Extractor:
    def __init__(self, jar_path="/home/ubuntu/pdffigures2/target/scala-2.12/pdffigures2-assembly-0.1.0.jar"):
        self.jar_path = jar_path
    
    def extract_tables(self, pdf_path, output_dir="/tmp/pdffigures2"):
        os.makedirs(output_dir, exist_ok=True)
        
        # Run pdffigures2
        cmd = [
            "java", "-Xmx10g", "-jar", self.jar_path,
            pdf_path,
            "-m", f"{output_dir}/images",
            "-d", f"{output_dir}/data"
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        
        if result.returncode != 0:
            raise Exception(f"pdffigures2 failed: {result.stderr}")
        
        # Parse JSON output
        json_file = f"{output_dir}/data/{os.path.basename(pdf_path)}.json"
        with open(json_file) as f:
            data = json.load(f)
        
        return self.parse_pdffigures2_output(data)
```

### Domain Mismatch Risk

pdffigures2 was designed for **computer science papers**, which have different characteristics than **clinical studies**:

| Feature | CS Papers | Clinical Studies |
|---------|-----------|------------------|
| Table style | Often bordered | Often borderless |
| Figure types | Diagrams, plots | Medical images, charts |
| Layout | 2-column | Variable |
| Terminology | CS-specific | Medical-specific |

**Risk**: May have lower accuracy on clinical studies than on CS papers.

---

## Option 3: scholarphi - Analysis

### What It Is
- **Interactive PDF reader** application
- UI for augmented reading experience
- **NOT an extraction tool**

### Components
- `ui/`: React-based PDF viewer
- `api/`: Web API for entity data
- `data-processing/`: Entity extraction scripts

### Why NOT Suitable
- ❌ Designed for **reading**, not **extraction**
- ❌ Requires full application deployment
- ❌ Complex architecture (UI + API + processing)
- ❌ Not a library or CLI tool
- ❌ Overkill for our use case

### Possible Use
The `data-processing/` directory might contain useful extraction scripts, but would require:
- Extracting scripts from full application
- Understanding custom data formats
- Significant refactoring

**Not recommended** for this use case.

---

## Recommendations

### Primary Recommendation: olmOCR with External API

**Why**:
1. ✅ **Lowest effort** (6-8 hours)
2. ✅ **Pure Python** (no language barrier)
3. ✅ **No GPU required** (external API)
4. ✅ **State-of-the-art accuracy** (VLM-based)
5. ✅ **Active development** (Nov 2025)
6. ✅ **Low cost** (~$0.0023/doc)
7. ✅ **Easy to test** (just need API key)
8. ✅ **Suitable for clinical studies** (general-purpose VLM)

**Implementation Path**:
1. Sign up for DeepInfra (free tier)
2. Implement `olmocr_extraction.py` (3-4 hours)
3. Integrate into unified API (1 hour)
4. Test and validate (2 hours)
5. Document and deploy (1 hour)

**Total**: 6-8 hours over 1-2 days

### Alternative Recommendation: pdffigures2

**When to use**:
- If external API dependency is not acceptable
- If cost is a major concern (even though olmOCR is cheap)
- If working primarily with CS papers (not clinical studies)

**Challenges**:
- Scala/JVM dependency
- Build complexity (sbt issues)
- Maintenance mode
- Domain mismatch risk

**Implementation Path**:
1. Resolve sbt build issues or use Docker
2. Build pdffigures2 JAR (2-3 hours)
3. Create Python wrapper (3-4 hours)
4. Integrate and test (3-4 hours)
5. Document (1 hour)

**Total**: 9-12 hours over 2-3 days

### NOT Recommended: scholarphi

- Not an extraction tool (interactive reader UI)
- Would require significant refactoring
- Overkill for our use case

---

## Implementation Roadmap (olmOCR)

### Week 1: Implementation

#### Day 1 (4 hours)
**Morning** (2 hours):
- [ ] Sign up for DeepInfra
- [ ] Get API key
- [ ] Configure environment variables
- [ ] Create `olmocr_extraction.py` skeleton

**Afternoon** (2 hours):
- [ ] Implement PDF → Image conversion
- [ ] Implement API calling logic
- [ ] Test basic extraction

#### Day 2 (4 hours)
**Morning** (2 hours):
- [ ] Implement Markdown → JSON parsing
- [ ] Add error handling
- [ ] Create unit tests

**Afternoon** (2 hours):
- [ ] Update `unified_extraction.py`
- [ ] Update API endpoints
- [ ] Integration testing

### Week 2: Validation & Deployment

#### Day 3 (2 hours)
**Morning** (1 hour):
- [ ] Test on Won2024.pdf
- [ ] Compare with existing methods
- [ ] Measure accuracy and performance

**Afternoon** (1 hour):
- [ ] Write documentation
- [ ] Create user guide
- [ ] Update README

#### Day 4 (1 hour)
- [ ] Deploy to production
- [ ] Monitor performance
- [ ] Gather feedback

**Total**: 6-8 hours over 4 days (part-time)

---

## Risk Assessment

### olmOCR Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| API downtime | Low | Medium | Automatic fallback to other methods |
| Rate limits exceeded | Low | Low | Free tier sufficient (100/day) |
| Higher cost than expected | Low | Low | Can be disabled, ~$2.30/month |
| Lower accuracy than expected | Low | Medium | Only used as fallback |
| API key security | Medium | High | Use environment variables, never commit |

### pdffigures2 Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Build failures | High | High | Use Docker or pre-built JAR |
| Domain mismatch (CS vs clinical) | Medium | High | Test thoroughly on clinical PDFs |
| Maintenance issues | Medium | Medium | Fork repo if needed |
| JVM memory issues | Low | Medium | Configure heap size properly |
| Subprocess errors | Medium | Medium | Robust error handling |

---

## Success Criteria

### Functional Requirements
- ✅ Successfully extracts tables from Won2024.pdf
- ✅ Integrates as 4th fallback method
- ✅ Can be enabled/disabled via configuration
- ✅ Handles errors gracefully
- ✅ Returns results in unified format

### Performance Requirements
- ✅ Latency < 10 seconds per page (acceptable for fallback)
- ✅ Cost < $0.01 per document
- ✅ Success rate > 90% for complex PDFs

### Quality Requirements
- ✅ Accuracy ≥ Camelot (98.87%)
- ✅ All tests passing
- ✅ Comprehensive documentation
- ✅ Proper logging and monitoring

---

## Cost-Benefit Analysis

### olmOCR (External API)

**Costs**:
- Implementation: 6-8 hours (~$300-400 developer time)
- Monthly API: ~$2.30/month (1000 docs)
- **Total Year 1**: ~$330-430

**Benefits**:
- State-of-the-art accuracy
- Handles complex PDFs that other methods fail on
- Easy to maintain (no local dependencies)
- Scales easily

**ROI**: High (low cost, high value)

### pdffigures2 (Local)

**Costs**:
- Implementation: 9-12 hours (~$450-600 developer time)
- Infrastructure: $0 (runs locally)
- Maintenance: Higher (JVM dependency, build issues)
- **Total Year 1**: ~$450-600

**Benefits**:
- No ongoing costs
- No external dependencies
- Deterministic results

**ROI**: Medium (higher upfront cost, domain mismatch risk)

---

## Conclusion

**Recommended Approach**: **olmOCR with External API (DeepInfra)**

**Rationale**:
1. **Lowest total effort** (6-8 hours vs 9-12 hours)
2. **Best accuracy** (state-of-the-art VLM)
3. **Lowest risk** (pure Python, no build issues)
4. **Best fit for clinical studies** (general-purpose, not CS-specific)
5. **Lowest cost** (~$2.30/month for 1000 documents)
6. **Easiest to maintain** (no local dependencies)

**Next Steps**:
1. Get approval for external API usage
2. Sign up for DeepInfra API key
3. Implement olmOCR integration (6-8 hours)
4. Test on Won2024.pdf
5. Deploy and monitor

**Alternative**: If external API is not acceptable, implement pdffigures2, but be prepared for:
- Higher implementation effort (9-12 hours)
- Build complexity (sbt issues)
- Domain mismatch risk (CS papers vs clinical studies)
- Ongoing maintenance burden

---

## Appendix: Detailed File Structure

### olmOCR Implementation

```
backend/app/api/
├── olmocr_extraction.py          # NEW: olmOCR extraction module
├── unified_extraction.py         # UPDATED: Add olmOCR as 4th method
├── pymupdf_table_extraction.py   # Existing
├── camelot_table_extraction.py   # Existing
└── tabula_table_extraction.py    # Existing

backend/
├── .env                          # UPDATED: Add OLMOCR_API_KEY
└── config.py                     # NEW: Configuration management

tests/
├── test_olmocr_extraction.py     # NEW: Unit tests
└── test_unified_extraction.py    # UPDATED: Integration tests

docs/
├── OLMOCR_SETUP_GUIDE.md        # NEW: Setup guide
└── API_DOCUMENTATION.md          # UPDATED: API docs
```

### pdffigures2 Implementation

```
/home/ubuntu/pdffigures2/
├── pdffigures2-assembly-0.1.0.jar  # Built JAR file
└── README.md

backend/app/api/
├── pdffigures2_extraction.py     # NEW: Python wrapper
├── unified_extraction.py         # UPDATED: Add pdffigures2 as 4th method
└── ...

tests/
├── test_pdffigures2_extraction.py  # NEW: Unit tests
└── ...
```

---

## Support Resources

- **olmOCR GitHub**: https://github.com/allenai/olmocr
- **pdffigures2 GitHub**: https://github.com/allenai/pdffigures2
- **DeepInfra Docs**: https://deepinfra.com/docs
- **Implementation Guide**: See ALLEN_AI_IMPLEMENTATION_PLAN.md
- **Technical Requirements**: See ALLEN_AI_TECHNICAL_REQUIREMENTS.md

---

**Report Prepared By**: Manus AI  
**Date**: November 8, 2025  
**Status**: Ready for Implementation Decision
