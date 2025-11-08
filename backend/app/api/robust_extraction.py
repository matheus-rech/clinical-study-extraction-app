"""
Robust PDF extraction using proven methods from Anthropic best practices
"""
from fastapi import APIRouter, UploadFile, File, Form
from fastapi.responses import JSONResponse
import pdfplumber
import fitz  # PyMuPDF
import tempfile
import os
from typing import List, Dict, Any
import subprocess
import json

router = APIRouter()

@router.post("/api/extract-tables-robust")
async def extract_tables_robust(
    file: UploadFile = File(...),
    pages: str = Form(None)
):
    """
    Extract tables using pdfplumber with detailed structure preservation
    """
    try:
        # Save uploaded file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_path = tmp_file.name
        
        tables_data = []
        
        with pdfplumber.open(tmp_path) as pdf:
            page_list = range(len(pdf.pages))
            if pages:
                try:
                    page_nums = [int(p.strip()) - 1 for p in pages.split(",")]
                    page_list = [p for p in page_nums if 0 <= p < len(pdf.pages)]
                except:
                    pass
            
            for page_num in page_list:
                page = pdf.pages[page_num]
                
                # Extract tables with settings for better accuracy
                tables = page.extract_tables({
                    "vertical_strategy": "lines_strict",
                    "horizontal_strategy": "lines_strict",
                    "intersection_tolerance": 5,
                })
                
                for table_idx, table in enumerate(tables):
                    if table and len(table) > 0:
                        # Convert to markdown
                        markdown = _table_to_markdown(table)
                        
                        # Get table bounding box
                        table_bbox = page.find_tables()[table_idx].bbox if page.find_tables() else None
                        
                        tables_data.append({
                            "page": page_num + 1,
                            "table_index": table_idx + 1,
                            "rows": len(table),
                            "cols": len(table[0]) if table else 0,
                            "markdown": markdown,
                            "bbox": table_bbox,
                            "raw_data": table[:10]  # First 10 rows for preview
                        })
        
        os.unlink(tmp_path)
        
        return JSONResponse({
            "success": True,
            "tables_found": len(tables_data),
            "tables": tables_data
        })
    
    except Exception as e:
        return JSONResponse({
            "success": False,
            "error": str(e)
        }, status_code=500)


@router.post("/api/extract-figures-robust")
async def extract_figures_robust(
    file: UploadFile = File(...),
    pages: str = Form(None),
    output_dir: str = Form("/tmp/extracted_figures")
):
    """
    Extract figures using PyMuPDF (fitz) with image metadata
    """
    try:
        # Save uploaded file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_path = tmp_file.name
        
        # Create output directory
        os.makedirs(output_dir, exist_ok=True)
        
        figures_data = []
        
        doc = fitz.open(tmp_path)
        
        page_list = range(len(doc))
        if pages:
            try:
                page_nums = [int(p.strip()) - 1 for p in pages.split(",")]
                page_list = [p for p in page_nums if 0 <= p < len(doc)]
            except:
                pass
        
        for page_num in page_list:
            page = doc[page_num]
            
            # Extract images
            image_list = page.get_images()
            
            for img_idx, img in enumerate(image_list):
                xref = img[0]
                base_image = doc.extract_image(xref)
                image_bytes = base_image["image"]
                image_ext = base_image["ext"]
                
                # Save image
                image_filename = f"page{page_num+1}_fig{img_idx+1}.{image_ext}"
                image_path = os.path.join(output_dir, image_filename)
                
                with open(image_path, "wb") as img_file:
                    img_file.write(image_bytes)
                
                # Get image position on page
                img_rect = page.get_image_rects(xref)
                bbox = img_rect[0] if img_rect else None
                
                figures_data.append({
                    "page": page_num + 1,
                    "figure_index": img_idx + 1,
                    "filename": image_filename,
                    "path": image_path,
                    "format": image_ext,
                    "size_bytes": len(image_bytes),
                    "bbox": [bbox.x0, bbox.y0, bbox.x1, bbox.y1] if bbox else None
                })
        
        doc.close()
        os.unlink(tmp_path)
        
        return JSONResponse({
            "success": True,
            "figures_found": len(figures_data),
            "figures": figures_data,
            "output_directory": output_dir
        })
    
    except Exception as e:
        return JSONResponse({
            "success": False,
            "error": str(e)
        }, status_code=500)


@router.post("/api/extract-text-bbox")
async def extract_text_with_bbox(
    file: UploadFile = File(...),
    pages: str = Form(None)
):
    """
    Extract text with bounding box coordinates using pdfplumber
    """
    try:
        # Save uploaded file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_path = tmp_file.name
        
        text_data = []
        
        with pdfplumber.open(tmp_path) as pdf:
            page_list = range(len(pdf.pages))
            if pages:
                try:
                    page_nums = [int(p.strip()) - 1 for p in pages.split(",")]
                    page_list = [p for p in page_nums if 0 <= p < len(pdf.pages)]
                except:
                    pass
            
            for page_num in page_list:
                page = pdf.pages[page_num]
                
                # Extract text with coordinates
                words = page.extract_words(
                    x_tolerance=3,
                    y_tolerance=3,
                    keep_blank_chars=False
                )
                
                # Group words into lines
                lines = _group_words_into_lines(words)
                
                text_data.append({
                    "page": page_num + 1,
                    "text": page.extract_text(),
                    "lines": lines[:50],  # First 50 lines
                    "word_count": len(words)
                })
        
        os.unlink(tmp_path)
        
        return JSONResponse({
            "success": True,
            "pages_processed": len(text_data),
            "data": text_data
        })
    
    except Exception as e:
        return JSONResponse({
            "success": False,
            "error": str(e)
        }, status_code=500)


def _table_to_markdown(table: List[List[str]]) -> str:
    """Convert table array to markdown format"""
    if not table or len(table) == 0:
        return ""
    
    markdown = []
    
    # Header
    header = table[0]
    markdown.append("| " + " | ".join([str(cell) if cell else "" for cell in header]) + " |")
    markdown.append("| " + " | ".join(["---"] * len(header)) + " |")
    
    # Rows
    for row in table[1:]:
        markdown.append("| " + " | ".join([str(cell) if cell else "" for cell in row]) + " |")
    
    return "\n".join(markdown)


def _group_words_into_lines(words: List[Dict]) -> List[Dict]:
    """Group words into lines based on y-coordinate"""
    if not words:
        return []
    
    # Sort by y0 (top coordinate)
    sorted_words = sorted(words, key=lambda w: (w['top'], w['x0']))
    
    lines = []
    current_line = []
    current_y = sorted_words[0]['top']
    y_tolerance = 3
    
    for word in sorted_words:
        if abs(word['top'] - current_y) <= y_tolerance:
            current_line.append(word)
        else:
            if current_line:
                line_text = " ".join([w['text'] for w in current_line])
                lines.append({
                    "text": line_text,
                    "bbox": [
                        min(w['x0'] for w in current_line),
                        min(w['top'] for w in current_line),
                        max(w['x1'] for w in current_line),
                        max(w['bottom'] for w in current_line)
                    ]
                })
            current_line = [word]
            current_y = word['top']
    
    # Add last line
    if current_line:
        line_text = " ".join([w['text'] for w in current_line])
        lines.append({
            "text": line_text,
            "bbox": [
                min(w['x0'] for w in current_line),
                min(w['top'] for w in current_line),
                max(w['x1'] for w in current_line),
                max(w['bottom'] for w in current_line)
            ]
        })
    
    return lines
