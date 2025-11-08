"""
Advanced Table and Figure Extraction for Clinical Studies
Based on Anthropic's best practices for PDF extraction
"""

from fastapi import APIRouter, UploadFile, File, HTTPException
from typing import List, Dict, Any
import pdfplumber
import tempfile
import os
import base64
from pdf2image import convert_from_path
import io

router = APIRouter()


def extract_tables_with_structure(pdf_path: str) -> List[Dict[str, Any]]:
    """
    Extract tables with preserved structure using pdfplumber
    Returns tables with metadata about their location and structure
    """
    tables_data = []
    
    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages):
            # Extract tables with settings optimized for clinical studies
            tables = page.extract_tables({
                "vertical_strategy": "lines_strict",
                "horizontal_strategy": "lines_strict",
                "intersection_tolerance": 5,
                "min_words_vertical": 3,
                "min_words_horizontal": 1
            })
            
            for table_idx, table in enumerate(tables):
                if not table or len(table) < 2:  # Skip empty or single-row tables
                    continue
                
                # Convert table to structured format
                headers = table[0] if table else []
                rows = table[1:] if len(table) > 1 else []
                
                # Create markdown representation
                markdown = create_table_markdown(headers, rows)
                
                # Get table bounding box
                table_bbox = page.find_tables()[table_idx].bbox if page.find_tables() else None
                
                tables_data.append({
                    "page": page_num + 1,
                    "table_index": table_idx + 1,
                    "headers": headers,
                    "rows": rows,
                    "row_count": len(rows),
                    "column_count": len(headers),
                    "markdown": markdown,
                    "bbox": {
                        "x0": table_bbox[0] if table_bbox else 0,
                        "y0": table_bbox[1] if table_bbox else 0,
                        "x1": table_bbox[2] if table_bbox else 0,
                        "y1": table_bbox[3] if table_bbox else 0
                    } if table_bbox else None
                })
    
    return tables_data


def create_table_markdown(headers: List[str], rows: List[List[str]]) -> str:
    """Convert table to markdown format for better AI processing"""
    if not headers or not rows:
        return ""
    
    # Clean headers and rows
    clean_headers = [str(h).strip() if h else "" for h in headers]
    clean_rows = [[str(cell).strip() if cell else "" for cell in row] for row in rows]
    
    # Create markdown table
    markdown_lines = []
    
    # Header row
    markdown_lines.append("| " + " | ".join(clean_headers) + " |")
    
    # Separator row
    markdown_lines.append("| " + " | ".join(["---"] * len(clean_headers)) + " |")
    
    # Data rows
    for row in clean_rows:
        # Pad row if it has fewer columns than headers
        padded_row = row + [""] * (len(clean_headers) - len(row))
        markdown_lines.append("| " + " | ".join(padded_row[:len(clean_headers)]) + " |")
    
    return "\n".join(markdown_lines)


def extract_figures_as_images(pdf_path: str, dpi: int = 200) -> List[Dict[str, Any]]:
    """
    Extract figures by converting PDF pages to images
    This captures both embedded images and vector graphics (charts, plots)
    """
    figures_data = []
    
    try:
        # Convert PDF pages to images
        images = convert_from_path(pdf_path, dpi=dpi)
        
        for page_num, image in enumerate(images):
            # Convert PIL Image to base64
            img_byte_arr = io.BytesIO()
            image.save(img_byte_arr, format='PNG')
            img_byte_arr.seek(0)
            img_base64 = base64.b64encode(img_byte_arr.read()).decode('utf-8')
            
            figures_data.append({
                "page": page_num + 1,
                "type": "page_image",
                "format": "PNG",
                "dpi": dpi,
                "width": image.width,
                "height": image.height,
                "base64": img_base64,
                "description": f"Page {page_num + 1} rendered as image (includes all figures, charts, and graphics)"
            })
    
    except Exception as e:
        print(f"Error extracting figures: {e}")
    
    return figures_data


@router.post("/api/extract-tables-advanced")
async def extract_tables_advanced(file: UploadFile = File(...)):
    """
    Advanced table extraction with structure preservation
    Returns tables in multiple formats: raw, markdown, and structured
    """
    try:
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_path = tmp_file.name
        
        try:
            tables = extract_tables_with_structure(tmp_path)
            
            return {
                "success": True,
                "table_count": len(tables),
                "tables": tables
            }
        
        finally:
            # Clean up temp file
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Table extraction failed: {str(e)}")


@router.post("/api/extract-figures-advanced")
async def extract_figures_advanced(file: UploadFile = File(...), dpi: int = 200):
    """
    Advanced figure extraction by rendering pages as high-resolution images
    Captures all visual content including charts, plots, and diagrams
    """
    try:
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_path = tmp_file.name
        
        try:
            figures = extract_figures_as_images(tmp_path, dpi=dpi)
            
            return {
                "success": True,
                "figure_count": len(figures),
                "figures": figures
            }
        
        finally:
            # Clean up temp file
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Figure extraction failed: {str(e)}")


@router.post("/api/extract-tables-and-figures")
async def extract_tables_and_figures(file: UploadFile = File(...)):
    """
    Combined endpoint for extracting both tables and figures
    Optimized for clinical study PDFs
    """
    try:
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_path = tmp_file.name
        
        try:
            tables = extract_tables_with_structure(tmp_path)
            figures = extract_figures_as_images(tmp_path, dpi=150)  # Lower DPI for faster processing
            
            return {
                "success": True,
                "table_count": len(tables),
                "figure_count": len(figures),
                "tables": tables,
                "figures": figures
            }
        
        finally:
            # Clean up temp file
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")
