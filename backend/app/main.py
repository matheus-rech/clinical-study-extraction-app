"""
PDF Processing Backend API for Clinical Study Extraction System

This FastAPI backend provides advanced PDF processing capabilities:
- Table extraction with pdfplumber
- Figure/image extraction with pypdfium2
- OCR for scanned PDFs with pytesseract
- Metadata search with CrossRef and PubMed APIs
- Batch processing with async support

Requirements:
    pip install fastapi uvicorn pdfplumber pypdfium2 pillow pytesseract pdf2image habanero biopython python-multipart
"""

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response, FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from typing import List, Optional
import io
import base64
import asyncio
from concurrent.futures import ThreadPoolExecutor
import logging
import os
import sys
import tempfile
from pathlib import Path

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Configuration
from app.core.config import settings

# PDF Processing
import pdfplumber
import pypdfium2 as pdfium
from PIL import Image
import numpy as np
from scipy import ndimage

# OCR
import pytesseract
from pdf2image import convert_from_bytes

# Metadata APIs
from habanero import Crossref
from Bio import Entrez
import requests
import re

# PDF Manipulation
from pdf_manipulation import PDFManipulator

# Advanced extraction routers
from app.api.advanced_extraction import router as advanced_router
from app.api.vision_extraction import router as vision_router
from app.api.figure_extraction import router as figure_router
from app.api.unified_extraction import router as unified_router
from app.api.export_service import router as export_router

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format=settings.LOG_FORMAT
)
logger = logging.getLogger(__name__)

# Log startup configuration
logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")
logger.info(f"Environment: {settings.ENVIRONMENT}")
logger.info(f"Debug mode: {settings.DEBUG}")
logger.info(f"CORS origins: {settings.CORS_ORIGINS}")

# Initialize FastAPI
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    debug=settings.DEBUG
)

# CORS middleware with environment-based configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure Entrez for PubMed
Entrez.email = os.getenv("ENTREZ_EMAIL", "your-email@example.com")

# Configure Tesseract path if specified
if settings.TESSERACT_CMD:
    pytesseract.pytesseract.tesseract_cmd = settings.TESSERACT_CMD

# Thread pool for CPU-intensive operations
executor = ThreadPoolExecutor(max_workers=settings.MAX_WORKERS)

# Include advanced extraction routers
app.include_router(advanced_router)
app.include_router(vision_router)
app.include_router(figure_router)
app.include_router(unified_router)
app.include_router(export_router)

# Determine frontend path (different for Docker vs local)
# In Docker (Hugging Face), frontend is at /home/user/app/frontend
# Locally, it's relative to the backend directory
FRONTEND_DIR = Path("/home/user/app/frontend/public") if os.path.exists("/home/user/app/frontend/public") else Path(__file__).parent.parent.parent / "frontend" / "public"

# Mount static files if frontend directory exists
if FRONTEND_DIR.exists():
    logger.info(f"Mounting frontend from: {FRONTEND_DIR}")
    # Mount static files (don't override API routes)
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")
else:
    logger.warning(f"Frontend directory not found at: {FRONTEND_DIR}")


# ==================== TABLE EXTRACTION ====================

@app.post("/api/extract-tables")
async def extract_tables(file: UploadFile = File(...)):
    """
    Extract tables from PDF with advanced layout detection

    Returns: List of tables with rows, columns, bounding boxes
    """
    try:
        pdf_bytes = await file.read()

        # Run in thread pool to avoid blocking
        tables = await asyncio.get_event_loop().run_in_executor(
            executor, _extract_tables_sync, pdf_bytes
        )

        return JSONResponse(content={"tables": tables, "count": len(tables)})

    except Exception as e:
        logger.error(f"Table extraction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def _extract_tables_sync(pdf_bytes: bytes) -> List[dict]:
    """Synchronous table extraction logic"""
    results = []

    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page_num, page in enumerate(pdf.pages, 1):
            # Custom settings optimized for clinical study tables
            table_settings = {
                "vertical_strategy": "lines_strict",
                "horizontal_strategy": "lines_strict",
                "snap_tolerance": 3,
                "intersection_tolerance": 15,
                "min_words_vertical": 3,
                "min_words_horizontal": 1,
                "text_tolerance": 3
            }

            # Extract tables
            tables_on_page = page.extract_tables(table_settings)

            if not tables_on_page:
                # Try alternative strategy for tables without borders
                table_settings["vertical_strategy"] = "text"
                table_settings["horizontal_strategy"] = "text"
                tables_on_page = page.extract_tables(table_settings)

            # Get table bounding boxes for highlighting
            table_objects = page.find_tables(table_settings)

            for i, (table, table_obj) in enumerate(zip(tables_on_page, table_objects)):
                if not table or len(table) == 0:
                    continue

                # Clean table data
                cleaned_table = [[cell.strip() if cell else "" for cell in row] for row in table]

                # Detect headers (usually first row)
                headers = cleaned_table[0] if cleaned_table else []
                data_rows = cleaned_table[1:] if len(cleaned_table) > 1 else []

                results.append({
                    'page': page_num,
                    'table_index': i,
                    'rows': cleaned_table,
                    'headers': headers,
                    'data_rows': data_rows,
                    'row_count': len(cleaned_table),
                    'col_count': len(cleaned_table[0]) if cleaned_table else 0,
                    'bbox': {
                        'x0': table_obj.bbox[0],
                        'y0': table_obj.bbox[1],
                        'x1': table_obj.bbox[2],
                        'y1': table_obj.bbox[3]
                    }
                })

    logger.info(f"Extracted {len(results)} tables")
    return results


# ==================== FIGURE EXTRACTION ====================

@app.post("/api/extract-figures")
async def extract_figures(file: UploadFile = File(...), page: Optional[int] = None):
    """
    Extract figures and images from PDF pages

    Returns: List of figures as base64-encoded images with bounding boxes
    """
    try:
        pdf_bytes = await file.read()

        figures = await asyncio.get_event_loop().run_in_executor(
            executor, _extract_figures_sync, pdf_bytes, page
        )

        return JSONResponse(content={"figures": figures, "count": len(figures)})

    except Exception as e:
        logger.error(f"Figure extraction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def _extract_figures_sync(pdf_bytes: bytes, target_page: Optional[int] = None) -> List[dict]:
    """Synchronous figure extraction with computer vision"""
    figures = []

    pdf = pdfium.PdfDocument(pdf_bytes)
    pages_to_process = [pdf[target_page - 1]] if target_page else list(pdf)

    for page_num, page in enumerate(pages_to_process, 1 if not target_page else target_page):
        # Render high-resolution page
        bitmap = page.render(scale=3.0)
        img = bitmap.to_pil()
        img_array = np.array(img)

        # Convert to grayscale
        gray = np.mean(img_array, axis=2)

        # Threshold to find non-white regions (potential figures)
        threshold = 245
        mask = gray < threshold

        # Morphological operations to clean up noise
        from scipy.ndimage import binary_opening, binary_closing
        mask = binary_opening(mask, structure=np.ones((5, 5)))
        mask = binary_closing(mask, structure=np.ones((10, 10)))

        # Label connected components
        labeled, num_features = ndimage.label(mask)

        for i in range(1, num_features + 1):
            component_mask = labeled == i
            rows = np.any(component_mask, axis=1)
            cols = np.any(component_mask, axis=0)

            if not rows.any() or not cols.any():
                continue

            y_min, y_max = np.where(rows)[0][[0, -1]]
            x_min, x_max = np.where(cols)[0][[0, -1]]

            # Calculate dimensions
            width = x_max - x_min
            height = y_max - y_min
            area = width * height
            aspect_ratio = width / height if height > 0 else 0

            # Filter by size and aspect ratio
            min_area = 15000  # Minimum size threshold
            max_area = img_array.size * 0.85  # Maximum (not full page)

            if area < min_area or area > max_area:
                continue

            # Skip very thin regions (likely lines, not figures)
            if aspect_ratio > 20 or aspect_ratio < 0.05:
                continue

            # Extract figure with padding
            padding = 10
            y_min_pad = max(0, y_min - padding)
            y_max_pad = min(img_array.shape[0], y_max + padding)
            x_min_pad = max(0, x_min - padding)
            x_max_pad = min(img_array.shape[1], x_max + padding)

            figure_img = img_array[y_min_pad:y_max_pad, x_min_pad:x_max_pad]
            figure_pil = Image.fromarray(figure_img.astype('uint8'))

            # Convert to base64
            buffered = io.BytesIO()
            figure_pil.save(buffered, format="JPEG", quality=85)
            img_base64 = base64.b64encode(buffered.getvalue()).decode()

            # Classify figure type (simple heuristics)
            figure_type = _classify_figure(figure_img)

            figures.append({
                'page': page_num,
                'figure_index': i,
                'bbox': {
                    'x0': int(x_min_pad),
                    'y0': int(y_min_pad),
                    'x1': int(x_max_pad),
                    'y1': int(y_max_pad)
                },
                'width': int(width),
                'height': int(height),
                'area': int(area),
                'aspect_ratio': round(aspect_ratio, 2),
                'type': figure_type,
                'image_base64': img_base64
            })

    logger.info(f"Extracted {len(figures)} figures")
    return figures


def _classify_figure(img_array: np.ndarray) -> str:
    """Simple figure classification based on visual characteristics"""
    # Calculate color distribution
    if len(img_array.shape) == 3:
        gray = np.mean(img_array, axis=2)
    else:
        gray = img_array

    # Edge density (graphs have many edges)
    from scipy.ndimage import sobel
    edges = sobel(gray)
    edge_density = np.sum(edges > 50) / edges.size

    # Color variance (medical images often have high variance)
    variance = np.var(gray)

    # Text density (flow charts have text)
    text_pixels = np.sum((gray < 240) & (gray > 200))
    text_density = text_pixels / gray.size

    # Classification heuristics
    if edge_density > 0.15 and variance > 1000:
        return "graph_or_chart"
    elif variance > 3000:
        return "medical_image"
    elif text_density > 0.1:
        return "flowchart_or_diagram"
    else:
        return "unknown_figure"


# ==================== OCR PROCESSING ====================

@app.post("/api/ocr-pdf")
async def ocr_pdf(file: UploadFile = File(...)):
    """
    Perform OCR on scanned PDF and return searchable text

    Returns: Extracted text per page with confidence scores
    """
    try:
        pdf_bytes = await file.read()

        ocr_results = await asyncio.get_event_loop().run_in_executor(
            executor, _ocr_pdf_sync, pdf_bytes
        )

        return JSONResponse(content={"ocr_results": ocr_results})

    except Exception as e:
        logger.error(f"OCR error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def _ocr_pdf_sync(pdf_bytes: bytes) -> List[dict]:
    """Synchronous OCR processing"""
    # Convert PDF to images
    images = convert_from_bytes(pdf_bytes, dpi=300)

    ocr_results = []
    for i, image in enumerate(images):
        # Perform OCR with detailed output
        ocr_data = pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT)

        # Get full text
        text = pytesseract.image_to_string(image, lang='eng')

        # Calculate average confidence
        confidences = [int(conf) for conf in ocr_data['conf'] if conf != '-1']
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0

        # Extract words with bounding boxes
        words = []
        for j in range(len(ocr_data['text'])):
            if ocr_data['text'][j].strip():
                words.append({
                    'text': ocr_data['text'][j],
                    'confidence': int(ocr_data['conf'][j]),
                    'bbox': {
                        'x': ocr_data['left'][j],
                        'y': ocr_data['top'][j],
                        'width': ocr_data['width'][j],
                        'height': ocr_data['height'][j]
                    }
                })

        ocr_results.append({
            'page': i + 1,
            'text': text,
            'confidence': round(avg_confidence, 2),
            'word_count': len(words),
            'words': words[:100]  # Limit to first 100 words for response size
        })

    logger.info(f"OCR completed for {len(ocr_results)} pages")
    return ocr_results


# ==================== METADATA SEARCH ====================

@app.post("/api/metadata-search")
async def metadata_search(query: dict):
    """
    Search for article metadata using multiple APIs

    Returns: Merged metadata from CrossRef, PubMed, and DOI resolution
    """
    try:
        search_query = query.get('query', '')

        # Run searches in parallel
        crossref_task = asyncio.get_event_loop().run_in_executor(
            executor, _search_crossref, search_query
        )
        pubmed_task = asyncio.get_event_loop().run_in_executor(
            executor, _search_pubmed, search_query
        )
        doi_task = asyncio.get_event_loop().run_in_executor(
            executor, _extract_and_resolve_doi, search_query
        )

        crossref_data, pubmed_data, doi_data = await asyncio.gather(
            crossref_task, pubmed_task, doi_task, return_exceptions=True
        )

        # Merge results
        merged = _merge_metadata(crossref_data, pubmed_data, doi_data)

        return JSONResponse(content={"metadata": merged})

    except Exception as e:
        logger.error(f"Metadata search error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def _search_crossref(query: str) -> Optional[dict]:
    """Search CrossRef API"""
    try:
        cr = Crossref()
        result = cr.works(query=query, limit=1)

        if result['message']['items']:
            item = result['message']['items'][0]
            return {
                'source': 'crossref',
                'title': item.get('title', [''])[0],
                'authors': [f"{a.get('given', '')} {a.get('family', '')}"
                           for a in item.get('author', [])],
                'journal': item.get('container-title', [''])[0],
                'year': item.get('published-print', {}).get('date-parts', [[None]])[0][0],
                'doi': item.get('DOI'),
                'abstract': item.get('abstract', ''),
                'confidence': item.get('score', 0) / 100
            }
    except Exception as e:
        logger.warning(f"CrossRef search failed: {e}")

    return None


def _search_pubmed(query: str) -> Optional[dict]:
    """Search PubMed API"""
    try:
        # Search for article
        search = Entrez.esearch(db="pubmed", term=query, retmax=1)
        record = Entrez.read(search)

        if record['IdList']:
            pmid = record['IdList'][0]

            # Fetch article details
            fetch = Entrez.efetch(db="pubmed", id=pmid, rettype="xml")
            article = Entrez.read(fetch)['PubmedArticle'][0]

            medline = article['MedlineCitation']
            article_data = medline['Article']

            return {
                'source': 'pubmed',
                'title': str(article_data['ArticleTitle']),
                'authors': [f"{a.get('ForeName', '')} {a.get('LastName', '')}"
                           for a in article_data.get('AuthorList', [])],
                'journal': str(article_data['Journal']['Title']),
                'year': article_data['Journal']['JournalIssue']['PubDate'].get('Year'),
                'pmid': pmid,
                'abstract': str(article_data.get('Abstract', {}).get('AbstractText', [''])[0]),
                'confidence': 0.9
            }
    except Exception as e:
        logger.warning(f"PubMed search failed: {e}")

    return None


def _extract_and_resolve_doi(text: str) -> Optional[dict]:
    """Extract and resolve DOI from text"""
    try:
        # Try to find DOI in text
        doi_pattern = r'10\.\d{4,}/[^\s]+'
        match = re.search(doi_pattern, text)

        if match:
            doi = match.group()

            # Resolve DOI to get metadata
            response = requests.get(
                f'https://api.crossref.org/works/{doi}',
                timeout=5
            )

            if response.ok:
                data = response.json()['message']
                return {
                    'source': 'doi',
                    'doi': doi,
                    'title': data.get('title', [''])[0],
                    'authors': [f"{a.get('given', '')} {a.get('family', '')}"
                               for a in data.get('author', [])],
                    'journal': data.get('container-title', [''])[0],
                    'year': data.get('published-print', {}).get('date-parts', [[None]])[0][0],
                    'confidence': 1.0  # High confidence when DOI found
                }
    except Exception as e:
        logger.warning(f"DOI resolution failed: {e}")

    return None


def _merge_metadata(crossref_data, pubmed_data, doi_data) -> dict:
    """Merge metadata from multiple sources with confidence scoring"""
    merged = {
        'sources': []
    }

    sources = [s for s in [crossref_data, pubmed_data, doi_data]
              if s and not isinstance(s, Exception)]

    if not sources:
        return merged

    # Add all sources
    merged['sources'] = [s['source'] for s in sources]

    # Merge fields with voting/confidence
    fields = ['title', 'authors', 'journal', 'year', 'doi', 'abstract']

    for field in fields:
        values = [(s[field], s.get('confidence', 0.5))
                 for s in sources if field in s and s[field]]

        if values:
            # Use value with highest confidence
            best_value, confidence = max(values, key=lambda x: x[1])
            merged[field] = best_value
            merged[f'{field}_confidence'] = confidence

    return merged


# ==================== BATCH PROCESSING ====================

@app.post("/api/batch-extract")
async def batch_extract(files: List[UploadFile] = File(...)):
    """
    Process multiple PDFs in parallel

    Returns: Extraction results for all files
    """
    try:
        async def process_one(file: UploadFile):
            try:
                pdf_bytes = await file.read()

                # Extract tables
                tables = await asyncio.get_event_loop().run_in_executor(
                    executor, _extract_tables_sync, pdf_bytes
                )

                # Extract figures (first 3 pages only for performance)
                figures = await asyncio.get_event_loop().run_in_executor(
                    executor, _extract_figures_sync, pdf_bytes, None
                )

                return {
                    'filename': file.filename,
                    'success': True,
                    'tables': tables,
                    'figures': figures[:5],  # Limit figures for response size
                    'table_count': len(tables),
                    'figure_count': len(figures)
                }
            except Exception as e:
                logger.error(f"Failed to process {file.filename}: {e}")
                return {
                    'filename': file.filename,
                    'success': False,
                    'error': str(e)
                }

        # Process up to 5 files in parallel
        results = await asyncio.gather(*[process_one(f) for f in files[:5]])

        return JSONResponse(content={"results": results, "count": len(results)})

    except Exception as e:
        logger.error(f"Batch processing error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== PDF QUALITY ASSESSMENT ====================

@app.post("/api/assess-quality")
async def assess_quality(file: UploadFile = File(...)):
    """
    Assess PDF quality and recommend extraction strategy

    Returns: Quality metrics and recommendations
    """
    try:
        pdf_bytes = await file.read()

        assessment = await asyncio.get_event_loop().run_in_executor(
            executor, _assess_quality_sync, pdf_bytes
        )

        return JSONResponse(content={"assessment": assessment})

    except Exception as e:
        logger.error(f"Quality assessment error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def _assess_quality_sync(pdf_bytes: bytes) -> dict:
    """Assess PDF characteristics"""
    assessment = {
        'total_pages': 0,
        'has_text': False,
        'has_tables': False,
        'has_images': False,
        'text_density': [],
        'quality_score': 0,
        'recommendations': []
    }

    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        assessment['total_pages'] = len(pdf.pages)

        # Sample first 5 pages
        for page in pdf.pages[:5]:
            text = page.extract_text()
            tables = page.extract_tables()

            if text and len(text) > 100:
                assessment['has_text'] = True
                assessment['text_density'].append(len(text))

            if tables:
                assessment['has_tables'] = True

            if len(page.images) > 0:
                assessment['has_images'] = True

        # Calculate quality score
        score = 0
        if assessment['has_text']:
            score += 40
        if assessment['has_tables']:
            score += 30
        if assessment['has_images']:
            score += 20

        if assessment['text_density']:
            avg_density = sum(assessment['text_density']) / len(assessment['text_density'])
            if avg_density > 500:
                score += 10

        assessment['quality_score'] = score

        # Generate recommendations
        if not assessment['has_text']:
            assessment['recommendations'].append({
                'level': 'critical',
                'message': '⚠️ No text detected - OCR required'
            })

        if assessment['has_tables']:
            assessment['recommendations'].append({
                'level': 'info',
                'message': '✓ Tables detected - use table extraction API'
            })

        if assessment['has_images']:
            assessment['recommendations'].append({
                'level': 'info',
                'message': '✓ Images detected - use figure extraction API'
            })

        if score >= 70:
            assessment['recommendations'].append({
                'level': 'success',
                'message': '✓ High-quality PDF - all extraction methods supported'
            })

    return assessment


# ==================== PDF MANIPULATION ====================

@app.post("/api/merge-pdfs")
async def merge_pdfs(files: List[UploadFile] = File(...)):
    """
    Merge multiple PDFs into one

    Use case: Combine main paper with supplementary materials
    """
    try:
        pdf_bytes_list = []
        for file in files:
            pdf_bytes = await file.read()
            pdf_bytes_list.append(pdf_bytes)

        manipulator = PDFManipulator()
        merged_pdf = manipulator.merge_pdfs(pdf_bytes_list)

        return Response(
            content=merged_pdf,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=merged.pdf"}
        )

    except Exception as e:
        logger.error(f"PDF merge error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/split-pdf")
async def split_pdf(file: UploadFile = File(...), page_ranges: Optional[str] = None):
    """
    Split PDF into multiple files

    Use case: Extract specific sections (methods, results, etc.)

    Args:
        file: PDF file to split
        page_ranges: Optional JSON string like "[[1,5],[6,10]]"
                    If not provided, splits into individual pages
    """
    try:
        pdf_bytes = await file.read()
        manipulator = PDFManipulator()

        # Parse page ranges if provided
        ranges = None
        if page_ranges:
            import json
            ranges = json.loads(page_ranges)
            ranges = [tuple(r) for r in ranges]

        split_results = manipulator.split_pdf(pdf_bytes, ranges)

        # Return as ZIP file
        import zipfile
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for filename, pdf_data in split_results.items():
                zip_file.writestr(filename, pdf_data)

        zip_buffer.seek(0)

        return Response(
            content=zip_buffer.read(),
            media_type="application/zip",
            headers={"Content-Disposition": "attachment; filename=split_pdfs.zip"}
        )

    except Exception as e:
        logger.error(f"PDF split error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/rotate-pages")
async def rotate_pages(
    file: UploadFile = File(...),
    rotation: int = 90,
    page_numbers: Optional[str] = None
):
    """
    Rotate pages in PDF

    Use case: Fix scanned pages that are sideways

    Args:
        rotation: Angle to rotate (90, 180, 270)
        page_numbers: Optional JSON array like "[2,3,5]"
    """
    try:
        pdf_bytes = await file.read()
        manipulator = PDFManipulator()

        # Parse page numbers if provided
        pages = None
        if page_numbers:
            import json
            pages = json.loads(page_numbers)

        rotated_pdf = manipulator.rotate_pages(pdf_bytes, rotation, pages)

        return Response(
            content=rotated_pdf,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=rotated.pdf"}
        )

    except Exception as e:
        logger.error(f"PDF rotation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/extract-metadata")
async def extract_pdf_metadata(file: UploadFile = File(...)):
    """
    Extract PDF metadata (title, author, etc.)

    Use case: Auto-populate citation information
    """
    try:
        pdf_bytes = await file.read()
        manipulator = PDFManipulator()

        metadata = manipulator.extract_metadata(pdf_bytes)

        return JSONResponse(content={"metadata": metadata})

    except Exception as e:
        logger.error(f"Metadata extraction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/watermark-pdf")
async def watermark_pdf(
    file: UploadFile = File(...),
    watermark_text: str = "EXTRACTED"
):
    """
    Add watermark to PDF

    Use case: Mark extracted documents for audit trail
    """
    try:
        pdf_bytes = await file.read()
        manipulator = PDFManipulator()

        watermarked_pdf = manipulator.add_watermark(pdf_bytes, watermark_text)

        return Response(
            content=watermarked_pdf,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=watermarked.pdf"}
        )

    except Exception as e:
        logger.error(f"Watermarking error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/encrypt-pdf")
async def encrypt_pdf(file: UploadFile = File(...), password: Optional[str] = None):
    """
    Add password protection to PDF

    Use case: Secure sensitive clinical data
    """
    try:
        if not password or password == "":
            password = "default123"  # Use default if not provided
            logger.warning("No password provided, using default")

        pdf_bytes = await file.read()
        manipulator = PDFManipulator()

        encrypted_pdf = manipulator.encrypt_pdf(pdf_bytes, password)

        return Response(
            content=encrypted_pdf,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=encrypted.pdf"}
        )

    except Exception as e:
        logger.error(f"Encryption error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/decrypt-pdf")
async def decrypt_pdf(file: UploadFile = File(...), password: str = ""):
    """
    Remove password protection from PDF

    Use case: Access password-protected papers
    """
    try:
        if not password:
            raise HTTPException(status_code=400, detail="Password is required")

        pdf_bytes = await file.read()
        manipulator = PDFManipulator()

        decrypted_pdf = manipulator.decrypt_pdf(pdf_bytes, password)

        return Response(
            content=decrypted_pdf,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=decrypted.pdf"}
        )

    except Exception as e:
        logger.error(f"Decryption error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/extract-images")
async def extract_images(file: UploadFile = File(...)):
    """
    Extract embedded images from PDF

    Use case: Get figures separately for analysis
    """
    try:
        pdf_bytes = await file.read()
        manipulator = PDFManipulator()

        images = manipulator.extract_images_from_pdf(pdf_bytes)

        # Return images as base64-encoded JSON
        import base64
        result = []
        for img in images:
            result.append({
                'page': img['page'],
                'name': img['name'],
                'size': img['size'],
                'format': img['format'],
                'data': base64.b64encode(img['data']).decode('utf-8')
            })

        return JSONResponse(content={"images": result, "count": len(result)})

    except Exception as e:
        logger.error(f"Image extraction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== HEALTH CHECK ====================

@app.get("/health")
async def health_check():
    """Health check endpoint for deployment validation"""
    return {"status": "ok", "service": "PDF Processing API", "version": settings.APP_VERSION}


@app.get("/")
async def root():
    """Serve the frontend HTML application or API info"""
    # Try to serve the frontend HTML file
    html_path = FRONTEND_DIR / "index.html" if FRONTEND_DIR.exists() else None
    
    if html_path and html_path.exists():
        logger.info(f"Serving frontend from: {html_path}")
        return FileResponse(str(html_path), media_type="text/html")
    
    # Fallback to API documentation if frontend not available
    logger.warning("Frontend not available, serving API info")
    return {
        "service": "Clinical Study PDF Processing API",
        "version": "2.0.0",
        "features": {
            "extraction": {
                "/api/extract-tables": "Extract tables from PDF",
                "/api/extract-figures": "Extract figures and images",
                "/api/extract-images": "Extract embedded images",
                "/api/extract-metadata": "Extract PDF metadata",
            },
            "processing": {
                "/api/ocr-pdf": "Perform OCR on scanned PDF",
                "/api/metadata-search": "Search for article metadata",
                "/api/batch-extract": "Process multiple PDFs",
                "/api/assess-quality": "Assess PDF quality",
            },
            "manipulation": {
                "/api/merge-pdfs": "Merge multiple PDFs",
                "/api/split-pdf": "Split PDF into sections",
                "/api/rotate-pages": "Rotate PDF pages",
                "/api/watermark-pdf": "Add watermark to PDF",
                "/api/encrypt-pdf": "Password protect PDF",
                "/api/decrypt-pdf": "Remove password from PDF",
            }
        },
        "endpoints_count": 14,
        "docs": "/docs (Swagger UI)",
        "health": "/health"
    }


# Add an API info endpoint for programmatic access
@app.get("/api")
async def api_info():
    """API information endpoint"""
    return {
        "service": "Clinical Study PDF Processing API",
        "version": "2.0.0",
        "features": {
            "extraction": {
                "/api/extract-tables": "Extract tables from PDF",
                "/api/extract-figures": "Extract figures and images",
                "/api/extract-images": "Extract embedded images",
                "/api/extract-metadata": "Extract PDF metadata",
            },
            "processing": {
                "/api/ocr-pdf": "Perform OCR on scanned PDF",
                "/api/metadata-search": "Search for article metadata",
                "/api/batch-extract": "Process multiple PDFs",
                "/api/assess-quality": "Assess PDF quality",
            },
            "manipulation": {
                "/api/merge-pdfs": "Merge multiple PDFs",
                "/api/split-pdf": "Split PDF into sections",
                "/api/rotate-pages": "Rotate PDF pages",
                "/api/watermark-pdf": "Add watermark to PDF",
                "/api/encrypt-pdf": "Password protect PDF",
                "/api/decrypt-pdf": "Remove password from PDF",
            }
        },
        "endpoints_count": 14,
        "docs": "/docs (Swagger UI)",
        "health": "/health"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")


# ==================== ENHANCED TEXT EXTRACTION FOR AI ====================

@app.post("/api/extract-text-for-ai")
async def extract_text_for_ai(file: UploadFile = File(...)):
    """
    Extract text from PDF optimized for AI processing.
    Uses layout-preserved extraction with pdfplumber for better quality.
    """
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="File must be a PDF")
    
    try:
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_path = tmp_file.name
        
        pages_text = []
        full_text_parts = []
        
        with pdfplumber.open(tmp_path) as pdf:
            for page_num, page in enumerate(pdf.pages, start=1):
                # Extract text with layout preservation
                text = page.extract_text(layout=True)
                
                if text:
                    pages_text.append({
                        'page': page_num,
                        'text': text,
                        'char_count': len(text)
                    })
                    full_text_parts.append(f"[PAGE {page_num}]\n{text}\n")
        
        # Clean up temp file
        os.unlink(tmp_path)
        
        full_text = "\n".join(full_text_parts)
        
        return {
            'full_text': full_text,
            'pages': pages_text,
            'total_pages': len(pages_text),
            'total_characters': len(full_text)
        }
    
    except Exception as e:
        if 'tmp_path' in locals() and os.path.exists(tmp_path):
            os.unlink(tmp_path)
        logger.error(f"Enhanced text extraction error: {e}")
        raise HTTPException(status_code=500, detail=f"Error extracting text: {str(e)}")
