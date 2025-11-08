"""
PyMuPDF-based table extraction module
Alternative to vision-based extraction using direct PDF parsing
"""
import fitz  # PyMuPDF
import re
from typing import List, Dict, Any, Optional
from pathlib import Path
import logging

logger = logging.getLogger(__name__)


class PyMuPDFTableExtractor:
    """Extract tables from PDF using PyMuPDF's built-in table detection"""
    
    def __init__(self, pdf_path: str):
        self.pdf_path = pdf_path
        self.doc = fitz.open(pdf_path)
    
    def extract_tables_from_page(self, page_num: int) -> List[Dict[str, Any]]:
        """
        Extract tables from a specific page using PyMuPDF
        
        Args:
            page_num: Page number (0-indexed)
            
        Returns:
            List of table dictionaries with markdown and metadata
        """
        try:
            page = self.doc[page_num]
            tables = []
            
            # Method 1: Use PyMuPDF's find_tables() method
            table_finder = page.find_tables()
            
            if table_finder.tables:
                for idx, table in enumerate(table_finder.tables):
                    # Extract table data
                    table_data = table.extract()
                    
                    # Convert to markdown
                    markdown = self._convert_to_markdown(table_data)
                    
                    # Get table bbox
                    bbox = table.bbox
                    
                    tables.append({
                        "table_index": idx,
                        "page": page_num + 1,  # 1-indexed for user display
                        "markdown": markdown,
                        "bbox": {
                            "x0": bbox[0],
                            "y0": bbox[1],
                            "x1": bbox[2],
                            "y1": bbox[3]
                        },
                        "rows": len(table_data),
                        "cols": len(table_data[0]) if table_data else 0,
                        "extraction_method": "pymupdf_find_tables"
                    })
                    
                logger.info(f"Extracted {len(tables)} tables from page {page_num + 1} using PyMuPDF")
                return tables
            
            # Method 2: Fallback to text block analysis for table detection
            logger.info(f"No tables found with find_tables(), trying text block analysis")
            tables_from_blocks = self._extract_tables_from_text_blocks(page, page_num)
            
            return tables_from_blocks
            
        except Exception as e:
            logger.error(f"Error extracting tables from page {page_num + 1}: {e}")
            return []
    
    def _extract_tables_from_text_blocks(self, page, page_num: int) -> List[Dict[str, Any]]:
        """
        Fallback method: Detect tables by analyzing text blocks and alignment
        """
        try:
            # Get all text blocks with position info
            blocks = page.get_text("dict")["blocks"]
            
            # Look for table-like structures (multiple aligned columns)
            table_candidates = []
            
            for block in blocks:
                if block.get("type") == 0:  # Text block
                    lines = block.get("lines", [])
                    
                    # Check if lines have consistent spacing (table-like)
                    if self._is_table_like(lines):
                        # Extract text with preserved spacing
                        text = page.get_textbox(block["bbox"])
                        
                        table_candidates.append({
                            "table_index": len(table_candidates),
                            "page": page_num + 1,
                            "markdown": self._text_to_markdown_table(text),
                            "bbox": {
                                "x0": block["bbox"][0],
                                "y0": block["bbox"][1],
                                "x1": block["bbox"][2],
                                "y1": block["bbox"][3]
                            },
                            "extraction_method": "pymupdf_text_blocks"
                        })
            
            return table_candidates
            
        except Exception as e:
            logger.error(f"Error in text block analysis: {e}")
            return []
    
    def _is_table_like(self, lines: List[Dict]) -> bool:
        """Check if text lines have table-like structure"""
        if len(lines) < 3:  # Need at least 3 rows for a table
            return False
        
        # Check for consistent spacing between spans (columns)
        span_counts = [len(line.get("spans", [])) for line in lines]
        
        # If most lines have multiple spans with similar counts, likely a table
        if len(set(span_counts)) <= 2 and max(span_counts) >= 2:
            return True
        
        return False
    
    def _convert_to_markdown(self, table_data: List[List[str]]) -> str:
        """Convert table data to markdown format"""
        if not table_data:
            return ""
        
        markdown_lines = []
        
        # Header row
        header = table_data[0]
        markdown_lines.append("| " + " | ".join(str(cell) if cell else "" for cell in header) + " |")
        
        # Separator
        markdown_lines.append("| " + " | ".join(["---"] * len(header)) + " |")
        
        # Data rows
        for row in table_data[1:]:
            # Pad row if needed
            padded_row = row + [""] * (len(header) - len(row))
            markdown_lines.append("| " + " | ".join(str(cell) if cell else "" for cell in padded_row) + " |")
        
        return "\n".join(markdown_lines)
    
    def _text_to_markdown_table(self, text: str) -> str:
        """Convert aligned text to markdown table (best effort)"""
        lines = text.strip().split("\n")
        
        if not lines:
            return ""
        
        # Simple conversion - split by whitespace
        markdown_lines = []
        
        for i, line in enumerate(lines):
            # Split by multiple spaces (likely column separators)
            cells = re.split(r'\s{2,}', line.strip())
            markdown_lines.append("| " + " | ".join(cells) + " |")
            
            # Add separator after first row
            if i == 0:
                markdown_lines.append("| " + " | ".join(["---"] * len(cells)) + " |")
        
        return "\n".join(markdown_lines)
    
    def extract_all_tables(self) -> List[Dict[str, Any]]:
        """Extract tables from all pages"""
        all_tables = []
        
        for page_num in range(len(self.doc)):
            tables = self.extract_tables_from_page(page_num)
            all_tables.extend(tables)
        
        return all_tables
    
    def close(self):
        """Close the PDF document"""
        if self.doc:
            self.doc.close()


def extract_tables_pymupdf(pdf_path: str, page_num: Optional[int] = None) -> List[Dict[str, Any]]:
    """
    Main function to extract tables using PyMuPDF
    
    Args:
        pdf_path: Path to PDF file
        page_num: Specific page number (1-indexed), or None for all pages
        
    Returns:
        List of extracted tables with markdown and metadata
    """
    extractor = PyMuPDFTableExtractor(pdf_path)
    
    try:
        if page_num is not None:
            # Extract from specific page (convert to 0-indexed)
            tables = extractor.extract_tables_from_page(page_num - 1)
        else:
            # Extract from all pages
            tables = extractor.extract_all_tables()
        
        return tables
    
    finally:
        extractor.close()
