# Allen AI Document Understanding - Research Findings

## Overview

Research conducted on Allen Institute for AI's document understanding tools to evaluate potential integration as a fourth fallback method for PDF extraction.

**Research Date**: November 8, 2025

---

## Allen AI Tools Evaluated

### 1. olmOCR (Recommended Primary Choice)

**Repository**: https://github.com/allenai/olmocr  
**Stars**: 15.9k  
**Status**: ✅ Active (Latest release: v0.4.4, Nov 4, 2025)  
**Type**: Vision Language Model (VLM) based OCR

#### What It Does
- Converts PDF, PNG, and JPEG documents into clean **Markdown**
- Supports **equations, tables, handwriting**, and complex formatting
- Automatically removes headers and footers
- Natural reading order even with figures, multi-column layouts
- Based on **7B parameter VLM** (olmOCR-2-7B-1025)

#### Technical Requirements
- **GPU Required**: NVIDIA GPU with **15+ GB VRAM** (tested on RTX 4090, L40S, A100, H100)
- **Disk Space**: 30GB free space
- **Dependencies**: 
  - poppler-utils
  - ttf-mscorefonts-installer
  - Python 3.11
  - PyTorch with CUDA 12.8
  - sglang (for inference)
  - Optional: flash-infer for faster inference

#### Installation Complexity
```bash
# System dependencies
sudo apt-get install poppler-utils ttf-mscorefonts-installer msttcorefonts fonts-crosextra-caladea fonts-crosextra-carlito gsfonts lcdf-typetools

# Python environment
conda create -n olmocr python=3.11
conda activate olmocr
pip install olmocr[gpu] --extra-index-url https://download.pytorch.org/whl/cu128
```

#### Usage
```bash
# Convert single PDF
python -m olmocr.pipeline ./workspace --markdown --pdfs sample.pdf

# Convert multiple PDFs
python -m olmocr.pipeline ./workspace --markdown --pdfs *.pdf

# Use external inference server
python -m olmocr.pipeline ./workspace --server http://remote:8000/v1 --markdown --pdfs *.pdf
```

#### Cost (External Providers)
- **Cirrascale**: $0.07/1M input tokens, $0.15/1M output tokens
- **DeepInfra**: $0.09/1M input tokens, $0.19/1M output tokens
- **Parasail**: $0.10/1M input tokens, $0.20/1M output tokens
- **Estimated**: ~$200 USD per million pages

#### Output Format
- **Markdown** with preserved structure
- **Dolma format** (optional)
- Tables extracted as markdown tables
- Equations preserved
- Natural reading order

#### Strengths
✅ State-of-the-art VLM-based extraction  
✅ Handles complex layouts (multi-column, figures, insets)  
✅ Supports equations and handwriting  
✅ Active development (released Nov 2025)  
✅ Can use external inference providers  
✅ Markdown output (easy to parse)

#### Weaknesses
❌ **Requires GPU** (15+ GB VRAM) - Not suitable for CPU-only servers  
❌ Large model download on first run  
❌ Higher computational cost  
❌ Not specialized for table/figure extraction (general OCR)  
❌ May be overkill for structured PDFs

#### Best For
- Complex, multi-column documents
- Scanned PDFs
- Documents with equations and handwriting
- When GPU resources are available
- When highest quality text extraction is needed

---

### 2. pdffigures2 (Specialized for Figures/Tables)

**Repository**: https://github.com/allenai/pdffigures2  
**Stars**: 691  
**Status**: ⚠️ Maintenance mode (Last commit: 2 years ago)  
**Type**: Rule-based figure and table extraction

#### What It Does
- Extracts **figures, tables, captions, and section titles** from scholarly PDFs
- Focused on **computer science papers**
- Returns structured JSON output
- Renders figures as images

#### Technical Requirements
- **Language**: Scala (JVM-based)
- **Build System**: sbt (Scala Build Tool)
- **Runtime**: Java 8+
- **Dependencies**:
  - PDFBox (for PDF parsing)
  - Optional: jai-imageio (for JPEG2000, JBIG2 support)

#### Installation Complexity
```bash
# Clone repo
git clone https://github.com/allenai/pdffigures2.git
cd pdffigures2

# Build with sbt
sbt assembly  # Creates standalone JAR

# Run
java -Xmx10g -jar target/scala-2.12/pdffigures2-assembly-0.1.0.jar input.pdf
```

#### Usage
```bash
# Extract from single PDF
sbt "runMain org.allenai.pdffigures2.FigureExtractorBatchCli /path/to/pdf -s stats.json -m /output/images -d /output/data"

# With visualization
sbt "runMain org.allenai.pdffigures2.FigureExtractorVisualizationCli /path/to/pdf"
```

#### Output Format
- **JSON** with figure metadata
- **Images** (PNG/JPG) of extracted figures
- **Bounding boxes** for each figure
- **Captions** extracted
- **Section titles** (experimental)

#### Algorithm Overview
1. Extract text from PDF
2. Remove headers, footers, abstracts
3. Identify captions
4. Locate graphical elements
5. Build complete captions
6. Classify text as "BodyText" or "Other"
7. Detect figure regions
8. Render figures to images

#### Strengths
✅ **Specialized** for scientific papers  
✅ **No GPU required** (CPU-only)  
✅ Extracts complete figures with captions  
✅ Rule-based (deterministic, explainable)  
✅ Can extract section titles  
✅ Lightweight (JVM-based)

#### Weaknesses
❌ **Scala/JVM dependency** (not Python)  
❌ **Maintenance mode** (last commit 2 years ago)  
❌ Focused on **computer science papers** (may not work well for clinical studies)  
❌ Requires sbt build system  
❌ Less accurate than modern VLM approaches

#### Best For
- Scientific papers (especially CS domain)
- When GPU is not available
- When deterministic extraction is needed
- Batch processing of many papers

---

### 3. science-parse (Metadata Extraction)

**Repository**: https://github.com/allenai/science-parse  
**Stars**: 677  
**Status**: ⚠️ Superseded by SPv2 (Last release: 2018)  
**Type**: Metadata and structure extraction

#### What It Does
- Extracts **metadata** from scientific papers:
  - Title, Authors, Abstract
  - Sections (heading + body)
  - Bibliography (with title, authors, venue, year)
  - Citations/mentions
- Returns structured JSON

#### Technical Requirements
- **Language**: Scala + Java (JVM-based)
- **Build System**: sbt
- **Runtime**: Java 8+
- **Model Files**: Downloads large ML models on first run

#### Installation Complexity
```bash
# As library (SBT)
libraryDependencies += "org.allenai" %% "science-parse" % "3.0.0"

# As library (Maven)
<dependency>
  <groupId>org.allenai</groupId>
  <artifactId>science-parse_2.12</artifactId>
  <version>3.0.0</version>
</dependency>

# CLI
sbt "cli/assembly"
java -Xmx10g -jar cli/target/scala-2.12/science-parse-cli-assembly-3.0.0.jar input.pdf
```

#### Output Format
- **JSON** with structured metadata
- Sections with headings and body text
- Bibliography entries
- Citation mentions

#### Strengths
✅ Extracts **structured metadata**  
✅ Good for **bibliography extraction**  
✅ Can be used as library  
✅ No GPU required

#### Weaknesses
❌ **Deprecated** (superseded by SPv2)  
❌ Last release: 2018  
❌ **Does NOT extract tables/figures** (metadata only)  
❌ Scala/JVM dependency  
❌ Not suitable for our use case (we need tables/figures, not metadata)

#### Best For
- Extracting paper metadata
- Building citation databases
- When you need bibliography information
- **NOT suitable for table/figure extraction**

---

### 4. pdf-component-library (UI Library)

**Repository**: https://github.com/allenai/pdf-component-library  
**Stars**: 82  
**Status**: ✅ Active  
**Type**: React UI components for PDF viewing

#### What It Does
- **React components** for displaying PDFs
- Built on top of React-PDF
- Features:
  - Citation popovers
  - PDF outlines
  - Thumbnails
  - Zoom controls
  - Text highlighting
  - Hypothesis.io integration
  - Scroll-to logic

#### Technical Requirements
- **Language**: TypeScript/React
- **Framework**: React
- **Dependencies**: React-PDF, pdfjs-dist

#### Installation
```bash
npm install @allenai/pdf-components
```

#### Strengths
✅ Great for **frontend visualization**  
✅ React-based (easy integration)  
✅ Interactive PDF reading experience  
✅ Used in Semantic Reader

#### Weaknesses
❌ **UI library only** (no extraction)  
❌ Not suitable for backend extraction  
❌ Requires React frontend

#### Best For
- Frontend PDF visualization
- Interactive reading experience
- **NOT for extraction** (UI only)

---

## Comparison Matrix

| Tool | Type | Language | GPU Required | Table Extraction | Figure Extraction | Status | Best For |
|------|------|----------|--------------|------------------|-------------------|--------|----------|
| **olmOCR** | VLM OCR | Python | ✅ Yes (15GB+) | ✅ Markdown | ✅ Markdown | ✅ Active | Complex layouts, scanned PDFs |
| **pdffigures2** | Rule-based | Scala/JVM | ❌ No | ✅ JSON | ✅ Images+JSON | ⚠️ Maintenance | Scientific papers (CS) |
| **science-parse** | Metadata | Scala/JVM | ❌ No | ❌ No | ❌ No | ❌ Deprecated | Metadata only |
| **pdf-component-library** | UI | TypeScript | ❌ No | ❌ No | ❌ No | ✅ Active | Frontend UI only |

---

## Recommendations for Integration

### Option A: olmOCR (Recommended if GPU available)

**Use Case**: When GPU resources are available and highest quality extraction is needed.

**Pros**:
- State-of-the-art accuracy
- Handles complex layouts
- Active development
- Can use external inference providers

**Cons**:
- Requires GPU (15+ GB VRAM)
- Higher computational cost
- Large model files

**Integration Effort**: **Medium-High**

### Option B: pdffigures2 (Recommended for CPU-only)

**Use Case**: When GPU is not available and working with scientific papers.

**Pros**:
- No GPU required
- Specialized for figures/tables
- Deterministic (rule-based)
- Lightweight

**Cons**:
- Scala/JVM dependency (not Python)
- Maintenance mode
- May not work well for clinical studies
- Requires sbt build

**Integration Effort**: **Medium**

### Option C: Hybrid Approach (Best of Both Worlds)

**Strategy**: Use external inference provider for olmOCR to avoid GPU requirement.

**Pros**:
- No local GPU needed
- State-of-the-art accuracy
- Pay-per-use pricing
- Easy integration

**Cons**:
- External API dependency
- Cost per request (~$0.10-0.20 per 1M tokens)
- Network latency

**Integration Effort**: **Low-Medium**

---

## Conclusion

**Best Choice for Clinical Study Extraction**: **olmOCR with external inference provider**

**Rationale**:
1. **No local GPU requirement** (use external provider)
2. **State-of-the-art accuracy** (VLM-based)
3. **Handles complex layouts** (multi-column, tables, figures)
4. **Active development** (released Nov 2025)
5. **Markdown output** (easy to parse)
6. **Reasonable cost** (~$0.10-0.20 per 1M tokens)

**Fallback**: If olmOCR fails or is too expensive, fall back to existing methods (PyMuPDF, Camelot, Tabula).

**Not Recommended**:
- **science-parse**: Doesn't extract tables/figures (metadata only)
- **pdf-component-library**: UI library only (no extraction)
- **pdffigures2**: Maintenance mode, Scala dependency, focused on CS papers

---

## Next Steps

1. Implement olmOCR integration with external inference provider
2. Test on Won2024.pdf clinical study
3. Compare accuracy vs. existing methods
4. Measure cost per extraction
5. Integrate as fourth fallback method in unified API
