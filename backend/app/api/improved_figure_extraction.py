"""
Improved figure extraction using PDF page rendering
Extracts complete figures by rendering page regions, not individual PDF image objects
"""
import fitz  # PyMuPDF
from typing import List, Dict, Any, Optional
from pathlib import Path
import base64
import io
from PIL import Image
import logging
import re

logger = logging.getLogger(__name__)


class ImprovedFigureExtractor:
    """Extract complete figures by analyzing page layout and rendering regions"""
    
    def __init__(self, pdf_path: str):
        self.pdf_path = pdf_path
        self.doc = fitz.open(pdf_path)
    
    def extract_figures_from_page(self, page_num: int, dpi: int = 150) -> List[Dict[str, Any]]:
        """
        Extract complete figures from a page by detecting figure regions
        
        Args:
            page_num: Page number (0-indexed)
            dpi: Resolution for rendering (default 150 for good quality)
            
        Returns:
            List of figure dictionaries with rendered images
        """
        try:
            page = self.doc[page_num]
            figures = []
            
            # Method 1: Look for "Figure" captions in text
            figure_regions = self._detect_figure_regions_by_caption(page)
            
            if figure_regions:
                logger.info(f"Found {len(figure_regions)} figure regions by caption on page {page_num + 1}")
                
                for idx, region in enumerate(figure_regions):
                    # Render the figure region
                    rendered_image = self._render_page_region(page, region['bbox'], dpi)
                    
                    if rendered_image:
                        figures.append({
                            "figure_index": idx,
                            "page": page_num + 1,
                            "caption": region.get('caption'),
                            "bbox": region['bbox'],
                            "width": rendered_image['width'],
                            "height": rendered_image['height'],
                            "image_base64": rendered_image['base64'],
                            "extraction_method": "render_by_caption"
                        })
            
            # Method 2: Detect large image clusters (fallback)
            if not figures:
                logger.info(f"No caption-based figures found, trying image cluster detection")
                cluster_regions = self._detect_figure_regions_by_image_clusters(page)
                
                for idx, region in enumerate(cluster_regions):
                    rendered_image = self._render_page_region(page, region['bbox'], dpi)
                    
                    if rendered_image:
                        figures.append({
                            "figure_index": idx,
                            "page": page_num + 1,
                            "caption": region.get('caption'),
                            "bbox": region['bbox'],
                            "width": rendered_image['width'],
                            "height": rendered_image['height'],
                            "image_base64": rendered_image['base64'],
                            "extraction_method": "render_by_cluster"
                        })
            
            logger.info(f"Extracted {len(figures)} complete figures from page {page_num + 1}")
            return figures
            
        except Exception as e:
            logger.error(f"Error extracting figures from page {page_num + 1}: {e}")
            return []
    
    def _detect_figure_regions_by_caption(self, page) -> List[Dict[str, Any]]:
        """
        Detect figure regions by finding 'Figure X.' captions
        """
        regions = []
        
        try:
            # Search for figure captions
            text_instances = page.search_for("Figure", quads=False)
            
            for rect in text_instances:
                # Get text around this position
                expanded_rect = fitz.Rect(
                    rect.x0 - 10,
                    rect.y0 - 200,  # Look above caption for the figure
                    rect.x1 + 400,  # Extend right for full caption
                    rect.y1 + 50    # Include caption text
                )
                
                # Ensure within page bounds
                expanded_rect = expanded_rect & page.rect
                
                # Get caption text
                caption_text = page.get_textbox(fitz.Rect(rect.x0, rect.y0, rect.x1 + 400, rect.y1 + 50))
                
                # Check if this looks like a figure caption (e.g., "Figure 1.", "Figure 2A.")
                if re.match(r'Figure\s+\d+[A-Z]?\.', caption_text.strip()):
                    regions.append({
                        'bbox': {
                            'x0': expanded_rect.x0,
                            'y0': expanded_rect.y0,
                            'x1': expanded_rect.x1,
                            'y1': expanded_rect.y1
                        },
                        'caption': caption_text.strip()
                    })
            
        except Exception as e:
            logger.debug(f"Error detecting figures by caption: {e}")
        
        return regions
    
    def _detect_figure_regions_by_image_clusters(self, page) -> List[Dict[str, Any]]:
        """
        Detect figure regions by finding clusters of images
        """
        regions = []
        
        try:
            # Get all images on page
            image_list = page.get_images(full=True)
            
            if not image_list:
                return []
            
            # Get image rectangles
            image_rects = []
            for img_info in image_list:
                xref = img_info[0]
                rects = page.get_image_rects(xref)
                if rects:
                    image_rects.extend(rects)
            
            if not image_rects:
                return []
            
            # Cluster nearby images
            clusters = self._cluster_rectangles(image_rects, distance_threshold=50)
            
            for cluster in clusters:
                # Create bounding box around cluster
                x0 = min(r.x0 for r in cluster)
                y0 = min(r.y0 for r in cluster)
                x1 = max(r.x1 for r in cluster)
                y1 = max(r.y1 for r in cluster)
                
                # Expand slightly to include borders
                bbox = fitz.Rect(x0 - 10, y0 - 10, x1 + 10, y1 + 10)
                
                # Only include if reasonably sized
                if bbox.width > 100 and bbox.height > 100:
                    # Try to find caption below
                    caption_rect = fitz.Rect(x0, y1, x1, min(y1 + 100, page.rect.height))
                    caption = page.get_textbox(caption_rect).strip()
                    
                    regions.append({
                        'bbox': {
                            'x0': bbox.x0,
                            'y0': bbox.y0,
                            'x1': bbox.x1,
                            'y1': bbox.y1
                        },
                        'caption': caption if caption else None
                    })
            
        except Exception as e:
            logger.debug(f"Error detecting figures by clusters: {e}")
        
        return regions
    
    def _cluster_rectangles(self, rects: List[fitz.Rect], distance_threshold: float = 50) -> List[List[fitz.Rect]]:
        """
        Cluster nearby rectangles together
        """
        if not rects:
            return []
        
        clusters = []
        used = set()
        
        for i, rect1 in enumerate(rects):
            if i in used:
                continue
            
            cluster = [rect1]
            used.add(i)
            
            for j, rect2 in enumerate(rects):
                if j in used:
                    continue
                
                # Check if rect2 is close to any rect in current cluster
                for cluster_rect in cluster:
                    if self._rect_distance(cluster_rect, rect2) < distance_threshold:
                        cluster.append(rect2)
                        used.add(j)
                        break
            
            clusters.append(cluster)
        
        return clusters
    
    def _rect_distance(self, rect1: fitz.Rect, rect2: fitz.Rect) -> float:
        """Calculate distance between two rectangles"""
        # Distance between centers
        center1_x = (rect1.x0 + rect1.x1) / 2
        center1_y = (rect1.y0 + rect1.y1) / 2
        center2_x = (rect2.x0 + rect2.x1) / 2
        center2_y = (rect2.y0 + rect2.y1) / 2
        
        return ((center1_x - center2_x)**2 + (center1_y - center2_y)**2)**0.5
    
    def _render_page_region(self, page, bbox: Dict, dpi: int = 150) -> Optional[Dict[str, Any]]:
        """
        Render a specific region of a page as an image
        """
        try:
            # Create clip rectangle
            clip_rect = fitz.Rect(bbox['x0'], bbox['y0'], bbox['x1'], bbox['y1'])
            
            # Render page region
            mat = fitz.Matrix(dpi/72, dpi/72)  # Scale matrix for DPI
            pix = page.get_pixmap(matrix=mat, clip=clip_rect)
            
            # Convert to PIL Image
            img_data = pix.tobytes("png")
            img = Image.open(io.BytesIO(img_data))
            
            # Convert to base64
            buffer = io.BytesIO()
            img.save(buffer, format='PNG')
            img_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
            
            return {
                'width': img.width,
                'height': img.height,
                'base64': img_base64
            }
            
        except Exception as e:
            logger.error(f"Error rendering page region: {e}")
            return None
    
    def extract_all_figures(self, dpi: int = 150) -> List[Dict[str, Any]]:
        """Extract figures from all pages"""
        all_figures = []
        
        for page_num in range(len(self.doc)):
            figures = self.extract_figures_from_page(page_num, dpi)
            all_figures.extend(figures)
        
        return all_figures
    
    def close(self):
        """Close the PDF document"""
        if self.doc:
            self.doc.close()


def extract_complete_figures(pdf_path: str, page_num: Optional[int] = None, dpi: int = 150) -> List[Dict[str, Any]]:
    """
    Main function to extract complete figures using improved method
    
    Args:
        pdf_path: Path to PDF file
        page_num: Specific page number (1-indexed), or None for all pages
        dpi: Resolution for rendering (default 150)
        
    Returns:
        List of extracted complete figures with rendered images
    """
    extractor = ImprovedFigureExtractor(pdf_path)
    
    try:
        if page_num is not None:
            # Extract from specific page (convert to 0-indexed)
            figures = extractor.extract_figures_from_page(page_num - 1, dpi)
        else:
            # Extract from all pages
            figures = extractor.extract_all_figures(dpi)
        
        return figures
    
    finally:
        extractor.close()
