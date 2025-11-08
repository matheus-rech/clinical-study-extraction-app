"""
PyMuPDF-based figure and image extraction module
Direct extraction of images from PDF without vision models
"""
import fitz  # PyMuPDF
from typing import List, Dict, Any, Optional
from pathlib import Path
import base64
import io
from PIL import Image
import logging

logger = logging.getLogger(__name__)


class PyMuPDFFigureExtractor:
    """Extract figures and images from PDF using PyMuPDF"""
    
    def __init__(self, pdf_path: str):
        self.pdf_path = pdf_path
        self.doc = fitz.open(pdf_path)
    
    def extract_images_from_page(self, page_num: int, min_width: int = 100, min_height: int = 100) -> List[Dict[str, Any]]:
        """
        Extract images from a specific page
        
        Args:
            page_num: Page number (0-indexed)
            min_width: Minimum image width to extract
            min_height: Minimum image height to extract
            
        Returns:
            List of image dictionaries with metadata
        """
        try:
            page = self.doc[page_num]
            images = []
            
            # Get list of images on the page
            image_list = page.get_images(full=True)
            
            if not image_list:
                logger.info(f"No images found on page {page_num + 1}")
                return []
            
            for img_idx, img_info in enumerate(image_list):
                try:
                    xref = img_info[0]  # Image xref number
                    
                    # Extract image data
                    base_image = self.doc.extract_image(xref)
                    
                    if not base_image:
                        continue
                    
                    image_bytes = base_image["image"]
                    image_ext = base_image["ext"]
                    width = base_image.get("width", 0)
                    height = base_image.get("height", 0)
                    
                    # Filter by size
                    if width < min_width or height < min_height:
                        logger.debug(f"Skipping small image: {width}x{height}")
                        continue
                    
                    # Get image position on page
                    img_rects = page.get_image_rects(xref)
                    bbox = img_rects[0] if img_rects else None
                    
                    # Convert to base64 for easy transport
                    image_base64 = base64.b64encode(image_bytes).decode('utf-8')
                    
                    # Try to get caption by looking at nearby text
                    caption = self._extract_caption_near_image(page, bbox) if bbox else None
                    
                    images.append({
                        "image_index": img_idx,
                        "page": page_num + 1,  # 1-indexed for display
                        "xref": xref,
                        "format": image_ext,
                        "width": width,
                        "height": height,
                        "size_bytes": len(image_bytes),
                        "bbox": {
                            "x0": bbox.x0,
                            "y0": bbox.y0,
                            "x1": bbox.x1,
                            "y1": bbox.y1
                        } if bbox else None,
                        "caption": caption,
                        "image_base64": image_base64,
                        "extraction_method": "pymupdf_direct"
                    })
                    
                except Exception as e:
                    logger.error(f"Error extracting image {img_idx} from page {page_num + 1}: {e}")
                    continue
            
            logger.info(f"Extracted {len(images)} images from page {page_num + 1}")
            return images
            
        except Exception as e:
            logger.error(f"Error extracting images from page {page_num + 1}: {e}")
            return []
    
    def _extract_caption_near_image(self, page, img_bbox, search_distance: int = 50) -> Optional[str]:
        """
        Try to extract caption text near an image
        
        Args:
            page: PyMuPDF page object
            img_bbox: Image bounding box
            search_distance: Distance in points to search for caption
            
        Returns:
            Caption text if found, None otherwise
        """
        try:
            # Search below the image for caption
            search_rect = fitz.Rect(
                img_bbox.x0,
                img_bbox.y1,
                img_bbox.x1,
                img_bbox.y1 + search_distance
            )
            
            caption_text = page.get_textbox(search_rect).strip()
            
            # Filter out non-caption text (heuristic: starts with "Figure", "Fig.", or contains numbers)
            if caption_text and (
                caption_text.startswith(("Figure", "Fig.", "FIG", "Table"))
                or any(char.isdigit() for char in caption_text[:20])
            ):
                return caption_text
            
            return None
            
        except Exception as e:
            logger.debug(f"Error extracting caption: {e}")
            return None
    
    def extract_all_images(self, min_width: int = 100, min_height: int = 100) -> List[Dict[str, Any]]:
        """Extract images from all pages"""
        all_images = []
        
        for page_num in range(len(self.doc)):
            images = self.extract_images_from_page(page_num, min_width, min_height)
            all_images.extend(images)
        
        return all_images
    
    def save_image(self, xref: int, output_path: str) -> bool:
        """
        Save an extracted image to file
        
        Args:
            xref: Image xref number
            output_path: Path to save image
            
        Returns:
            True if successful, False otherwise
        """
        try:
            base_image = self.doc.extract_image(xref)
            
            if not base_image:
                return False
            
            image_bytes = base_image["image"]
            
            # Save to file
            with open(output_path, "wb") as f:
                f.write(image_bytes)
            
            logger.info(f"Saved image {xref} to {output_path}")
            return True
            
        except Exception as e:
            logger.error(f"Error saving image {xref}: {e}")
            return False
    
    def close(self):
        """Close the PDF document"""
        if self.doc:
            self.doc.close()


def extract_figures_pymupdf(pdf_path: str, page_num: Optional[int] = None, 
                           min_width: int = 100, min_height: int = 100) -> List[Dict[str, Any]]:
    """
    Main function to extract figures/images using PyMuPDF
    
    Args:
        pdf_path: Path to PDF file
        page_num: Specific page number (1-indexed), or None for all pages
        min_width: Minimum image width
        min_height: Minimum image height
        
    Returns:
        List of extracted images with metadata
    """
    extractor = PyMuPDFFigureExtractor(pdf_path)
    
    try:
        if page_num is not None:
            # Extract from specific page (convert to 0-indexed)
            images = extractor.extract_images_from_page(page_num - 1, min_width, min_height)
        else:
            # Extract from all pages
            images = extractor.extract_all_images(min_width, min_height)
        
        return images
    
    finally:
        extractor.close()
