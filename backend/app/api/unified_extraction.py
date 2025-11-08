"""
Unified extraction API with multiple methods and intelligent fallbacks
Tries multiple extraction approaches in order of reliability
"""
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from typing import Optional, List, Dict, Any
import tempfile
import os
import logging
from pathlib import Path

# Import all extraction modules
try:
    from app.api.pymupdf_table_extraction import extract_tables_pymupdf
    from app.api.camelot_table_extraction import extract_tables_camelot
    from app.api.tabula_table_extraction import extract_tables_tabula
    from app.api.improved_figure_extraction import extract_complete_figures
except ImportError:
    # Fallback for direct script execution
    import sys
    import os
    sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    from backend.app.api.pymupdf_table_extraction import extract_tables_pymupdf
    from backend.app.api.camelot_table_extraction import extract_tables_camelot
    from backend.app.api.tabula_table_extraction import extract_tables_tabula
    from backend.app.api.improved_figure_extraction import extract_complete_figures

logger = logging.getLogger(__name__)

router = APIRouter()


class UnifiedExtractor:
    """Unified extractor with multiple methods and fallbacks"""
    
    # Priority order for table extraction methods
    TABLE_METHODS = [
        ("pymupdf", extract_tables_pymupdf),
        ("camelot", extract_tables_camelot),
        ("tabula", extract_tables_tabula)
    ]
    
    # Priority order for figure extraction methods
    FIGURE_METHODS = [
        ("improved_render", extract_complete_figures)
    ]
    
    @staticmethod
    def extract_tables(pdf_path: str, page_num: Optional[int] = None, 
                      method: Optional[str] = None) -> Dict[str, Any]:
        """
        Extract tables with intelligent fallback
        
        Args:
            pdf_path: Path to PDF file
            page_num: Specific page number (1-indexed), or None for all pages
            method: Specific method to use, or None to try all methods
            
        Returns:
            Dictionary with extraction results and metadata
        """
        results = {
            "success": False,
            "tables": [],
            "method_used": None,
            "methods_tried": [],
            "errors": []
        }
        
        # If specific method requested, try only that one
        if method:
            methods_to_try = [(m, f) for m, f in UnifiedExtractor.TABLE_METHODS if m == method]
            if not methods_to_try:
                results["errors"].append(f"Unknown method: {method}")
                return results
        else:
            methods_to_try = UnifiedExtractor.TABLE_METHODS
        
        # Try each method in order
        for method_name, extract_func in methods_to_try:
            try:
                logger.info(f"Trying table extraction with {method_name}")
                results["methods_tried"].append(method_name)
                
                tables = extract_func(pdf_path, page_num)
                
                if tables and len(tables) > 0:
                    results["success"] = True
                    results["tables"] = tables
                    results["method_used"] = method_name
                    results["table_count"] = len(tables)
                    
                    logger.info(f"Successfully extracted {len(tables)} tables using {method_name}")
                    return results
                else:
                    logger.info(f"No tables found with {method_name}")
                    
            except Exception as e:
                error_msg = f"{method_name} failed: {str(e)}"
                logger.error(error_msg)
                results["errors"].append(error_msg)
                continue
        
        # If we get here, no method succeeded
        if not results["success"]:
            results["errors"].append("All extraction methods failed or found no tables")
        
        return results
    
    @staticmethod
    def extract_figures(pdf_path: str, page_num: Optional[int] = None,
                       method: Optional[str] = None) -> Dict[str, Any]:
        """
        Extract figures with intelligent fallback
        
        Args:
            pdf_path: Path to PDF file
            page_num: Specific page number (1-indexed), or None for all pages
            method: Specific method to use, or None to try all methods
            
        Returns:
            Dictionary with extraction results and metadata
        """
        results = {
            "success": False,
            "figures": [],
            "method_used": None,
            "methods_tried": [],
            "errors": []
        }
        
        # If specific method requested, try only that one
        if method:
            methods_to_try = [(m, f) for m, f in UnifiedExtractor.FIGURE_METHODS if m == method]
            if not methods_to_try:
                results["errors"].append(f"Unknown method: {method}")
                return results
        else:
            methods_to_try = UnifiedExtractor.FIGURE_METHODS
        
        # Try each method in order
        for method_name, extract_func in methods_to_try:
            try:
                logger.info(f"Trying figure extraction with {method_name}")
                results["methods_tried"].append(method_name)
                
                figures = extract_func(pdf_path, page_num)
                
                if figures and len(figures) > 0:
                    results["success"] = True
                    results["figures"] = figures
                    results["method_used"] = method_name
                    results["figure_count"] = len(figures)
                    
                    logger.info(f"Successfully extracted {len(figures)} figures using {method_name}")
                    return results
                else:
                    logger.info(f"No figures found with {method_name}")
                    
            except Exception as e:
                error_msg = f"{method_name} failed: {str(e)}"
                logger.error(error_msg)
                results["errors"].append(error_msg)
                continue
        
        # If we get here, no method succeeded
        if not results["success"]:
            results["errors"].append("All extraction methods failed or found no figures")
        
        return results


@router.post("/api/extract-tables-unified")
async def extract_tables_unified_endpoint(
    file: UploadFile = File(...),
    page: Optional[int] = None,
    method: Optional[str] = None
):
    """
    Unified table extraction endpoint with multiple methods
    
    Args:
        file: PDF file to extract from
        page: Optional page number (1-indexed)
        method: Optional specific method ('pymupdf', 'camelot', 'tabula')
    """
    temp_file = None
    
    try:
        # Save uploaded file to temp location
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_path = temp_file.name
        
        # Extract tables
        results = UnifiedExtractor.extract_tables(temp_path, page, method)
        
        return JSONResponse(content=results)
        
    except Exception as e:
        logger.error(f"Error in unified table extraction: {e}")
        raise HTTPException(status_code=500, detail=str(e))
        
    finally:
        # Clean up temp file
        if temp_file and os.path.exists(temp_path):
            try:
                os.unlink(temp_path)
            except:
                pass


@router.post("/api/extract-figures-unified")
async def extract_figures_unified_endpoint(
    file: UploadFile = File(...),
    page: Optional[int] = None,
    method: Optional[str] = None
):
    """
    Unified figure extraction endpoint with multiple methods
    
    Args:
        file: PDF file to extract from
        page: Optional page number (1-indexed)
        method: Optional specific method ('pymupdf')
    """
    temp_file = None
    
    try:
        # Save uploaded file to temp location
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_path = temp_file.name
        
        # Extract figures
        results = UnifiedExtractor.extract_figures(temp_path, page, method)
        
        return JSONResponse(content=results)
        
    except Exception as e:
        logger.error(f"Error in unified figure extraction: {e}")
        raise HTTPException(status_code=500, detail=str(e))
        
    finally:
        # Clean up temp file
        if temp_file and os.path.exists(temp_path):
            try:
                os.unlink(temp_path)
            except:
                pass


@router.get("/api/extraction-methods")
async def get_extraction_methods():
    """Get list of available extraction methods"""
    return {
        "table_methods": [m for m, _ in UnifiedExtractor.TABLE_METHODS],
        "figure_methods": [m for m, _ in UnifiedExtractor.FIGURE_METHODS]
    }
