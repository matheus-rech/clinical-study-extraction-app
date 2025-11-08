"""
Comprehensive Figure Extraction for Clinical Studies
Extracts figure images from PDFs and provides AI-powered descriptions
"""

from fastapi import APIRouter, UploadFile, File, HTTPException
from typing import List, Dict, Any, Optional
import tempfile
import os
import base64
from pdf2image import convert_from_path
import io
from PIL import Image
import requests
import json

router = APIRouter()

# Get API keys from environment
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")


def extract_page_images(pdf_path: str, pages: List[int] = None, dpi: int = 200) -> List[Dict[str, Any]]:
    """
    Convert PDF pages to images using pdf2image
    Returns list of page images with metadata
    """
    images_data = []
    
    try:
        # Convert PDF pages to images
        if pages:
            images = convert_from_path(pdf_path, dpi=dpi, first_page=min(pages), last_page=max(pages))
        else:
            images = convert_from_path(pdf_path, dpi=dpi)
        
        for idx, pil_image in enumerate(images):
            # Convert to base64
            img_byte_arr = io.BytesIO()
            pil_image.save(img_byte_arr, format='PNG')
            img_byte_arr.seek(0)
            img_base64 = base64.b64encode(img_byte_arr.read()).decode('utf-8')
            
            page_num = pages[idx] if pages else idx + 1
            
            images_data.append({
                "page": page_num,
                "width": pil_image.width,
                "height": pil_image.height,
                "format": "PNG",
                "base64": img_base64
            })
    
    except Exception as e:
        print(f"Error converting PDF pages to images: {e}")
    
    return images_data


def analyze_page_with_gemini(image_base64: str, page_num: int) -> List[Dict[str, Any]]:
    """
    Use Gemini Vision API to identify and describe figures/tables in a page image
    """
    if not GEMINI_API_KEY:
        return []
    
    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key={GEMINI_API_KEY}"
        
        prompt = """Analyze this page from a clinical study PDF and identify all figures, charts, graphs, and tables.
        
For each visual element found, provide:
1. Type (e.g., "Bar Chart", "Line Graph", "Table", "Flowchart", "Image")
2. Title or caption (if visible)
3. Brief description of what it shows
4. Approximate position on page (top, middle, bottom)

Return as JSON array with format:
[
  {
    "type": "...",
    "title": "...",
    "description": "...",
    "position": "..."
  }
]

If no figures/tables found, return empty array []."""
        
        payload = {
            "contents": [{
                "parts": [
                    {"text": prompt},
                    {
                        "inline_data": {
                            "mime_type": "image/png",
                            "data": image_base64
                        }
                    }
                ]
            }],
            "generationConfig": {
                "response_mime_type": "application/json"
            }
        }
        
        response = requests.post(url, json=payload, timeout=60)
        response.raise_for_status()
        
        result = response.json()
        if "candidates" in result and len(result["candidates"]) > 0:
            text = result["candidates"][0]["content"]["parts"][0]["text"]
            figures = json.loads(text)
            
            # Add page number to each figure
            for fig in figures:
                fig["page"] = page_num
            
            return figures
    
    except Exception as e:
        print(f"Error analyzing page {page_num} with Gemini: {e}")
    
    return []


def analyze_page_with_claude(image_base64: str, page_num: int) -> List[Dict[str, Any]]:
    """
    Use Claude Vision API to identify and describe figures/tables in a page image
    """
    if not ANTHROPIC_API_KEY:
        return []
    
    try:
        url = "https://api.anthropic.com/v1/messages"
        
        prompt = """Analyze this page from a clinical study PDF and identify all figures, charts, graphs, and tables.
        
For each visual element found, provide:
1. Type (e.g., "Bar Chart", "Line Graph", "Table", "Flowchart", "Image")
2. Title or caption (if visible)
3. Brief description of what it shows
4. Approximate position on page (top, middle, bottom)

Return as JSON array with format:
[
  {
    "type": "...",
    "title": "...",
    "description": "...",
    "position": "..."
  }
]

If no figures/tables found, return empty array []."""
        
        headers = {
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        }
        
        payload = {
            "model": "claude-sonnet-4-5",
            "max_tokens": 2000,
            "messages": [{
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/png",
                            "data": image_base64
                        }
                    },
                    {
                        "type": "text",
                        "text": prompt
                    }
                ]
            }]
        }
        
        response = requests.post(url, headers=headers, json=payload, timeout=90)
        response.raise_for_status()
        
        result = response.json()
        if "content" in result and len(result["content"]) > 0:
            text = result["content"][0]["text"]
            # Extract JSON from response
            import re
            json_match = re.search(r'\[.*\]', text, re.DOTALL)
            if json_match:
                figures = json.loads(json_match.group(0))
                
                # Add page number to each figure
                for fig in figures:
                    fig["page"] = page_num
                
                return figures
    
    except Exception as e:
        print(f"Error analyzing page {page_num} with Claude: {e}")
    
    return []


@router.post("/api/extract-figures-complete")
async def extract_figures_complete(
    file: UploadFile = File(...),
    pages: Optional[str] = None,
    provider: str = "gemini",
    dpi: int = 200
):
    """
    Comprehensive figure extraction:
    1. Converts specified PDF pages to images
    2. Uses vision AI to identify and describe figures
    3. Returns both images and descriptions
    
    Parameters:
    - file: PDF file
    - pages: Comma-separated page numbers (e.g., "1,3,5") or None for all pages
    - provider: AI provider ("gemini" or "claude")
    - dpi: Image resolution (default 200)
    """
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    
    # Parse pages parameter
    page_list = None
    if pages:
        try:
            page_list = [int(p.strip()) for p in pages.split(',')]
        except:
            raise HTTPException(status_code=400, detail="Invalid pages parameter")
    
    # Save uploaded file temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp_file:
        content = await file.read()
        tmp_file.write(content)
        tmp_path = tmp_file.name
    
    try:
        # Extract page images
        page_images = extract_page_images(tmp_path, page_list, dpi)
        
        if not page_images:
            return {
                "success": False,
                "message": "No images extracted from PDF",
                "figures": []
            }
        
        # Analyze each page with vision AI
        all_figures = []
        for page_img in page_images:
            if provider.lower() == "claude":
                figures = analyze_page_with_claude(page_img["base64"], page_img["page"])
            else:
                figures = analyze_page_with_gemini(page_img["base64"], page_img["page"])
            
            all_figures.extend(figures)
        
        return {
            "success": True,
            "total_figures": len(all_figures),
            "pages_analyzed": len(page_images),
            "provider": provider,
            "figures": all_figures
        }
    
    finally:
        # Clean up temp file
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
