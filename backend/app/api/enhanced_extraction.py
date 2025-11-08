"""
Enhanced PDF text extraction with layout preservation
"""
from fastapi import APIRouter, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
import pdfplumber
import tempfile
import os
from typing import List, Dict, Any

router = APIRouter()

@router.post("/api/extract-text-enhanced")
async def extract_text_enhanced(file: UploadFile = File(...)):
    """
    Extract text from PDF with layout preservation and coordinates.
    Returns structured text that's better for AI processing.
    """
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="File must be a PDF")
    
    try:
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_path = tmp_file.name
        
        pages_data = []
        
        with pdfplumber.open(tmp_path) as pdf:
            for page_num, page in enumerate(pdf.pages, start=1):
                # Extract text with layout preservation
                text = page.extract_text(layout=True)
                
                # Extract text with coordinates for each word
                words = page.extract_words(
                    x_tolerance=3,
                    y_tolerance=3,
                    keep_blank_chars=False
                )
                
                # Group words by lines based on y-coordinate
                lines = []
                if words:
                    current_line = []
                    current_y = words[0]['top']
                    
                    for word in words:
                        # If word is on a different line (y-coordinate differs significantly)
                        if abs(word['top'] - current_y) > 5:
                            if current_line:
                                lines.append({
                                    'text': ' '.join([w['text'] for w in current_line]),
                                    'bbox': {
                                        'x0': min(w['x0'] for w in current_line),
                                        'y0': min(w['top'] for w in current_line),
                                        'x1': max(w['x1'] for w in current_line),
                                        'y1': max(w['bottom'] for w in current_line)
                                    }
                                })
                            current_line = [word]
                            current_y = word['top']
                        else:
                            current_line.append(word)
                    
                    # Add the last line
                    if current_line:
                        lines.append({
                            'text': ' '.join([w['text'] for w in current_line]),
                            'bbox': {
                                'x0': min(w['x0'] for w in current_line),
                                'y0': min(w['top'] for w in current_line),
                                'x1': max(w['x1'] for w in current_line),
                                'y1': max(w['bottom'] for w in current_line)
                            }
                        })
                
                # Create structured text for AI
                structured_text = "\n".join([line['text'] for line in lines])
                
                pages_data.append({
                    'page': page_num,
                    'text': text,  # Layout-preserved text
                    'structured_text': structured_text,  # Line-by-line text
                    'lines': lines,  # Text with coordinates
                    'width': float(page.width),
                    'height': float(page.height)
                })
        
        # Clean up temp file
        os.unlink(tmp_path)
        
        return JSONResponse(content={
            'pages': pages_data,
            'total_pages': len(pages_data)
        })
    
    except Exception as e:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
        raise HTTPException(status_code=500, detail=f"Error processing PDF: {str(e)}")


@router.post("/api/extract-full-document")
async def extract_full_document(file: UploadFile = File(...)):
    """
    Extract complete document text optimized for AI analysis.
    Returns a single formatted text string with all pages.
    """
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="File must be a PDF")
    
    try:
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_path = tmp_file.name
        
        full_text = []
        
        with pdfplumber.open(tmp_path) as pdf:
            for page_num, page in enumerate(pdf.pages, start=1):
                # Extract text with layout preservation
                text = page.extract_text(layout=True)
                
                if text:
                    full_text.append(f"=== PAGE {page_num} ===\n{text}\n")
        
        # Clean up temp file
        os.unlink(tmp_path)
        
        combined_text = "\n".join(full_text)
        
        return JSONResponse(content={
            'text': combined_text,
            'total_pages': len(full_text),
            'character_count': len(combined_text)
        })
    
    except Exception as e:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
        raise HTTPException(status_code=500, detail=f"Error processing PDF: {str(e)}")
