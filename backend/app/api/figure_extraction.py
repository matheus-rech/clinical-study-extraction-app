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
import pypdfium2 as pdfium
import requests
import json

router = APIRouter()

# Get API keys from environment
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")


def extract_images_from_pdf(pdf_path: str) -> List[Dict[str, Any]]:
    """
    Extract embedded images from PDF using pypdfium2
    Returns list of images with metadata
    """
    images_data = []
    
    try:
        pdf = pdfium.PdfDocument(pdf_path)
        
        for page_index in range(len(pdf)):
            page = pdf[page_index]
            
            # Get all image objects on the page
            for obj_index, obj in enumerate(page.get_objects()):
                if obj.type == pdfium.PDFOBJ_IMAGE:
                    try:
                        # Extract image
                        image = obj.get_bitmap()
                        pil_image = image.to_pil()
                        
                        # Convert to base64
                        img_byte_arr = io.BytesIO()
                        pil_image.save(img_byte_arr, format='PNG')
                        img_byte_arr.seek(0)
                        img_base64 = base64.b64encode(img_byte_arr.read()).decode('utf-8')
                        
                        # Get position
                        matrix = obj.get_matrix()
                        
                        images_data.append({
                            "page": page_index + 1,
                            "image_index": obj_index + 1,
                            "width": pil_image.width,
                            "height": pil_image.height,
                            "format": "PNG",
                            "base64": img_base64,
                            "position": {
                                "x": matrix.a if matrix else 0,
                                "y": matrix.b if matrix else 0
                            }
                        })
                    except Exception as e:
                        print(f"Error extracting image {obj_index} from page {page_index + 1}: {e}")
                        continue
        
        pdf.close()
    
    except Exception as e:
        print(f"Error processing PDF: {e}")
    
    return images_data


def render_pdf_pages_as_images(pdf_path: str, dpi: int = 200) -> List[Dict[str, Any]]:
    """
    Render entire PDF pages as high-resolution images
    Useful for capturing figures that are vector graphics or complex layouts
    """
    images_data = []
    
    try:
        images = convert_from_path(pdf_path, dpi=dpi)
        
        for page_num, image in enumerate(images):
            # Convert to base64
            img_byte_arr = io.BytesIO()
            image.save(img_byte_arr, format='PNG')
            img_byte_arr.seek(0)
            img_base64 = base64.b64encode(img_byte_arr.read()).decode('utf-8')
            
            images_data.append({
                "page": page_num + 1,
                "type": "full_page_render",
                "width": image.width,
                "height": image.height,
                "format": "PNG",
                "dpi": dpi,
                "base64": img_base64
            })
    
    except Exception as e:
        print(f"Error rendering PDF pages: {e}")
    
    return images_data


def describe_figure_with_ai(image_base64: str, provider: str = "gemini") -> Dict[str, Any]:
    """
    Use vision AI to analyze and describe a figure
    """
    
    prompt = """Analyze this figure from a clinical study and provide a detailed description.

Identify:
1. Figure type (e.g., bar chart, line graph, scatter plot, Kaplan-Meier curve, forest plot, flow diagram, medical image, etc.)
2. What the figure shows (main message)
3. Key data points, trends, or patterns
4. Axis labels, legend information
5. Statistical annotations (p-values, confidence intervals, error bars, etc.)
6. Any text labels or captions visible in the figure

Return JSON:
{
  "figure_type": "...",
  "title": "...",
  "description": "...",
  "key_findings": ["...", "..."],
  "statistical_info": "...",
  "axes_labels": {"x": "...", "y": "..."},
  "data_summary": "..."
}"""
    
    try:
        if provider.lower() == "anthropic" and ANTHROPIC_API_KEY:
            # Use Claude 4.5
            headers = {
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json"
            }
            payload = {
                "model": "claude-sonnet-4-5",
                "max_tokens": 2048,
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
            
            # Extract JSON from markdown code block if present
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0].strip()
            elif "```" in text:
                text = text.split("```")[1].split("```")[0].strip()
            
            return json.loads(text)
        
        else:
            # Use Gemini 2.5
            if not GEMINI_API_KEY:
                raise ValueError("No AI provider API key configured")
            
            api_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key={GEMINI_API_KEY}"
            payload = {
                "contents": [{
                    "parts": [
                        {"text": prompt},
                        {"inline_data": {"mime_type": "image/png", "data": image_base64}}
                    ]
                }],
                "generationConfig": {
                    "temperature": 0.1,
                    "responseMimeType": "application/json"
                }
            }
            response = requests.post(api_url, json=payload, timeout=60)
            response.raise_for_status()
            text = response.json().get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "{}")
            return json.loads(text)
    
    except Exception as e:
        return {
            "error": str(e),
            "figure_type": "unknown",
            "description": "Failed to analyze figure"
        }


@router.post("/api/extract-figures-complete")
async def extract_figures_complete(
    file: UploadFile = File(...),
    provider: str = "gemini",
    extract_embedded: bool = True,
    render_pages: bool = True,
    analyze_with_ai: bool = True,
    dpi: int = 200,
    pages: Optional[str] = None
):
    """
    Comprehensive figure extraction:
    1. Extract embedded images from PDF
    2. Render pages as high-res images (for vector graphics/charts)
    3. Use AI to describe each figure
    
    Args:
        file: PDF file
        provider: "gemini" or "anthropic" for AI analysis
        extract_embedded: Extract embedded images
        render_pages: Render full pages as images
        analyze_with_ai: Use vision AI to describe figures
        dpi: Resolution for page rendering
        pages: Comma-separated page numbers or "all"
    
    Returns:
        JSON with extracted figures, images, and AI descriptions
    """
    try:
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_path = tmp_file.name
        
        try:
            all_figures = []
            
            # 1. Extract embedded images
            if extract_embedded:
                embedded_images = extract_images_from_pdf(tmp_path)
                
                for img_data in embedded_images:
                    figure_info = {
                        "source": "embedded_image",
                        "page": img_data["page"],
                        "image_index": img_data.get("image_index"),
                        "width": img_data["width"],
                        "height": img_data["height"],
                        "format": img_data["format"],
                        "base64": img_data["base64"],
                        "position": img_data.get("position")
                    }
                    
                    # Analyze with AI if requested
                    if analyze_with_ai:
                        ai_description = describe_figure_with_ai(img_data["base64"], provider)
                        figure_info["ai_analysis"] = ai_description
                    
                    all_figures.append(figure_info)
            
            # 2. Render pages as images (for vector graphics/charts)
            if render_pages:
                from pdf2image import pdfinfo_from_path
                pdf_info = pdfinfo_from_path(tmp_path)
                total_pages = pdf_info.get("Pages", 1)
                
                if pages == "all" or pages is None:
                    page_numbers = list(range(1, total_pages + 1))
                else:
                    page_numbers = [int(p.strip()) for p in pages.split(",") if p.strip().isdigit()]
                
                for page_num in page_numbers:
                    if page_num < 1 or page_num > total_pages:
                        continue
                    
                    # Render single page
                    images = convert_from_path(tmp_path, dpi=dpi, first_page=page_num, last_page=page_num)
                    if images:
                        img_byte_arr = io.BytesIO()
                        images[0].save(img_byte_arr, format='PNG')
                        img_byte_arr.seek(0)
                        img_base64 = base64.b64encode(img_byte_arr.read()).decode('utf-8')
                        
                        figure_info = {
                            "source": "page_render",
                            "page": page_num,
                            "width": images[0].width,
                            "height": images[0].height,
                            "format": "PNG",
                            "dpi": dpi,
                            "base64": img_base64
                        }
                        
                        # Analyze with AI if requested
                        if analyze_with_ai:
                            ai_description = describe_figure_with_ai(img_base64, provider)
                            figure_info["ai_analysis"] = ai_description
                        
                        all_figures.append(figure_info)
            
            return {
                "success": True,
                "provider": provider if analyze_with_ai else "none",
                "figure_count": len(all_figures),
                "figures": all_figures
            }
        
        finally:
            # Clean up temp file
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Figure extraction failed: {str(e)}")


@router.post("/api/save-figure")
async def save_figure(
    figure_data: Dict[str, Any],
    output_dir: str = "/tmp/figures"
):
    """
    Save an extracted figure to disk
    
    Args:
        figure_data: Figure data with base64 image
        output_dir: Directory to save figures
    
    Returns:
        File path of saved figure
    """
    try:
        os.makedirs(output_dir, exist_ok=True)
        
        # Decode base64
        image_bytes = base64.b64decode(figure_data["base64"])
        
        # Generate filename
        page = figure_data.get("page", 0)
        index = figure_data.get("image_index", 0)
        source = figure_data.get("source", "unknown")
        filename = f"figure_page{page}_{source}_{index}.png"
        filepath = os.path.join(output_dir, filename)
        
        # Save file
        with open(filepath, "wb") as f:
            f.write(image_bytes)
        
        return {
            "success": True,
            "filepath": filepath,
            "filename": filename
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save figure: {str(e)}")
