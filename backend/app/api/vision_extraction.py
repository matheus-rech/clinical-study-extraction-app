"""
Vision-based Table and Figure Extraction using Gemini and Anthropic Vision APIs
This provides superior accuracy compared to traditional PDF parsing
"""

from fastapi import APIRouter, UploadFile, File, HTTPException
from typing import List, Dict, Any, Optional
import tempfile
import os
import base64
from pdf2image import convert_from_path
import io
import requests
import json

router = APIRouter()

# Get API keys from environment
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")


def pdf_page_to_base64(pdf_path: str, page_num: int, dpi: int = 200) -> str:
    """Convert a specific PDF page to base64 encoded image"""
    images = convert_from_path(pdf_path, dpi=dpi, first_page=page_num, last_page=page_num)
    if not images:
        raise ValueError(f"Could not convert page {page_num}")
    
    img_byte_arr = io.BytesIO()
    images[0].save(img_byte_arr, format='PNG')
    img_byte_arr.seek(0)
    return base64.b64encode(img_byte_arr.read()).decode('utf-8')


def extract_tables_with_gemini_vision(image_base64: str, page_num: int) -> Dict[str, Any]:
    """Use Gemini Vision to extract and transcribe tables from a PDF page image"""
    
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY not configured")
    
    api_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key={GEMINI_API_KEY}"
    
    prompt = """Analyze this page from a clinical study PDF and extract ALL tables.

For each table found:
1. Transcribe it accurately in markdown format
2. Preserve the exact structure (rows, columns, headers)
3. Include all numerical values, percentages, and statistical notations
4. Maintain alignment and formatting

Return a JSON object with this structure:
{
  "tables": [
    {
      "table_number": 1,
      "title": "Table title or caption if visible",
      "markdown": "| Header 1 | Header 2 |\\n|---|---|\\n| Data 1 | Data 2 |",
      "description": "Brief description of what the table shows",
      "location": "approximate location on page (e.g., 'top', 'middle', 'bottom')"
    }
  ],
  "table_count": 0
}

If no tables are found, return {"tables": [], "table_count": 0}"""
    
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
            "temperature": 0.1,
            "topP": 0.8,
            "topK": 40,
            "responseMimeType": "application/json"
        }
    }
    
    try:
        response = requests.post(api_url, json=payload, timeout=60)
        response.raise_for_status()
        result = response.json()
        
        text = result.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "{}")
        data = json.loads(text)
        
        # Add page number to each table
        for table in data.get("tables", []):
            table["page"] = page_num
        
        return data
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini Vision API error: {str(e)}")


def extract_tables_with_anthropic_vision(image_base64: str, page_num: int) -> Dict[str, Any]:
    """Use Anthropic Claude Vision to extract and transcribe tables from a PDF page image"""
    
    if not ANTHROPIC_API_KEY:
        raise ValueError("ANTHROPIC_API_KEY not configured")
    
    api_url = "https://api.anthropic.com/v1/messages"
    
    prompt = """Analyze this page from a clinical study PDF and extract ALL tables.

For each table found:
1. Transcribe it accurately in markdown format
2. Preserve the exact structure (rows, columns, headers)
3. Include all numerical values, percentages, and statistical notations
4. Maintain alignment and formatting

Return a JSON object with this structure:
{
  "tables": [
    {
      "table_number": 1,
      "title": "Table title or caption if visible",
      "markdown": "| Header 1 | Header 2 |\\n|---|---|\\n| Data 1 | Data 2 |",
      "description": "Brief description of what the table shows",
      "location": "approximate location on page (e.g., 'top', 'middle', 'bottom')"
    }
  ],
  "table_count": 0
}

If no tables are found, return {"tables": [], "table_count": 0}"""
    
    headers = {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
    }
    
    payload = {
        "model": "claude-sonnet-4-5",
        "max_tokens": 4096,
        "messages": [
            {
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
            }
        ]
    }
    
    try:
        response = requests.post(api_url, headers=headers, json=payload, timeout=60)
        response.raise_for_status()
        result = response.json()
        
        text = result.get("content", [{}])[0].get("text", "{}")
        # Extract JSON from markdown code block if present
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()
        
        data = json.loads(text)
        
        # Add page number to each table
        for table in data.get("tables", []):
            table["page"] = page_num
        
        return data
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Anthropic Vision API error: {str(e)}")


@router.post("/api/extract-tables-vision")
async def extract_tables_vision(
    file: UploadFile = File(...),
    provider: str = "gemini",
    dpi: int = 200,
    pages: Optional[str] = None
):
    """
    Extract tables from PDF using vision AI (Gemini or Anthropic)
    
    Args:
        file: PDF file to process
        provider: "gemini" or "anthropic"
        dpi: Resolution for PDF to image conversion (default 200)
        pages: Comma-separated page numbers (e.g., "1,3,5") or "all" for all pages
    
    Returns:
        JSON with extracted tables in markdown format
    """
    try:
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_path = tmp_file.name
        
        try:
            # Determine which pages to process
            from pdf2image import pdfinfo_from_path
            pdf_info = pdfinfo_from_path(tmp_path)
            total_pages = pdf_info.get("Pages", 1)
            
            if pages == "all" or pages is None:
                page_numbers = list(range(1, total_pages + 1))
            else:
                page_numbers = [int(p.strip()) for p in pages.split(",") if p.strip().isdigit()]
            
            all_tables = []
            total_table_count = 0
            
            for page_num in page_numbers:
                if page_num < 1 or page_num > total_pages:
                    continue
                
                # Convert page to image
                image_base64 = pdf_page_to_base64(tmp_path, page_num, dpi)
                
                # Extract tables using selected provider
                if provider.lower() == "anthropic":
                    result = extract_tables_with_anthropic_vision(image_base64, page_num)
                else:  # default to gemini
                    result = extract_tables_with_gemini_vision(image_base64, page_num)
                
                tables = result.get("tables", [])
                all_tables.extend(tables)
                total_table_count += len(tables)
            
            return {
                "success": True,
                "provider": provider,
                "pages_processed": len(page_numbers),
                "total_pages": total_pages,
                "table_count": total_table_count,
                "tables": all_tables
            }
        
        finally:
            # Clean up temp file
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Vision extraction failed: {str(e)}")


@router.post("/api/extract-figures-vision")
async def extract_figures_vision(
    file: UploadFile = File(...),
    provider: str = "gemini",
    dpi: int = 200,
    pages: Optional[str] = None
):
    """
    Extract and describe figures/charts from PDF using vision AI
    
    Args:
        file: PDF file to process
        provider: "gemini" or "anthropic"
        dpi: Resolution for PDF to image conversion (default 200)
        pages: Comma-separated page numbers or "all"
    
    Returns:
        JSON with figure descriptions and data
    """
    try:
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_path = tmp_file.name
        
        try:
            from pdf2image import pdfinfo_from_path
            pdf_info = pdfinfo_from_path(tmp_path)
            total_pages = pdf_info.get("Pages", 1)
            
            if pages == "all" or pages is None:
                page_numbers = list(range(1, total_pages + 1))
            else:
                page_numbers = [int(p.strip()) for p in pages.split(",") if p.strip().isdigit()]
            
            all_figures = []
            
            for page_num in page_numbers:
                if page_num < 1 or page_num > total_pages:
                    continue
                
                image_base64 = pdf_page_to_base64(tmp_path, page_num, dpi)
                
                # Analyze figures with vision AI
                prompt = """Analyze this page from a clinical study PDF and identify ALL figures, charts, graphs, and diagrams.

For each figure found, provide:
1. Figure number and title/caption
2. Type (e.g., bar chart, line graph, scatter plot, diagram, image)
3. Detailed description of what it shows
4. Key data points or trends visible
5. Any statistical annotations (p-values, confidence intervals, etc.)

Return JSON:
{
  "figures": [
    {
      "figure_number": "Figure 1",
      "title": "...",
      "type": "...",
      "description": "...",
      "key_findings": ["...", "..."],
      "location": "top/middle/bottom"
    }
  ],
  "figure_count": 0
}"""
                
                if provider.lower() == "anthropic":
                    # Call Anthropic API
                    headers = {
                        "x-api-key": ANTHROPIC_API_KEY,
                        "anthropic-version": "2023-06-01",
                        "content-type": "application/json"
                    }
                    payload = {
                        "model": "claude-sonnet-4-5",
                        "max_tokens": 4096,
                        "messages": [{
                            "role": "user",
                            "content": [
                                {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": image_base64}},
                                {"type": "text", "text": prompt}
                            ]
                        }]
                    }
                    response = requests.post("https://api.anthropic.com/v1/messages", headers=headers, json=payload, timeout=60)
                    response.raise_for_status()
                    text = response.json().get("content", [{}])[0].get("text", "{}")
                    if "```json" in text:
                        text = text.split("```json")[1].split("```")[0].strip()
                    data = json.loads(text)
                else:
                    # Call Gemini API
                    api_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key={GEMINI_API_KEY}"
                    payload = {
                        "contents": [{
                            "parts": [
                                {"text": prompt},
                                {"inline_data": {"mime_type": "image/png", "data": image_base64}}
                            ]
                        }],
                        "generationConfig": {"temperature": 0.1, "responseMimeType": "application/json"}
                    }
                    response = requests.post(api_url, json=payload, timeout=60)
                    response.raise_for_status()
                    text = response.json().get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "{}")
                    data = json.loads(text)
                
                figures = data.get("figures", [])
                for fig in figures:
                    fig["page"] = page_num
                all_figures.extend(figures)
            
            return {
                "success": True,
                "provider": provider,
                "pages_processed": len(page_numbers),
                "figure_count": len(all_figures),
                "figures": all_figures
            }
        
        finally:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Figure extraction failed: {str(e)}")
