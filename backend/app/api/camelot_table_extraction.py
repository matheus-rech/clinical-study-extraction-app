"""
Camelot-based table extraction module
Specialized library for PDF table extraction with high accuracy
"""
import camelot
from typing import List, Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)


class CamelotTableExtractor:
    """Extract tables using Camelot library"""
    
    def __init__(self, pdf_path: str):
        self.pdf_path = pdf_path
    
    def extract_tables_from_page(self, page_num: int, flavor: str = 'lattice') -> List[Dict[str, Any]]:
        """
        Extract tables from a specific page using Camelot
        
        Args:
            page_num: Page number (1-indexed for Camelot)
            flavor: 'lattice' for tables with lines, 'stream' for tables without lines
            
        Returns:
            List of table dictionaries with markdown and metadata
        """
        try:
            # Try lattice first (for tables with borders)
            tables = camelot.read_pdf(
                self.pdf_path,
                pages=str(page_num),
                flavor=flavor
            )
            
            if not tables or len(tables) == 0:
                # Fallback to stream flavor if lattice finds nothing
                if flavor == 'lattice':
                    logger.info(f"Lattice found no tables on page {page_num}, trying stream")
                    return self.extract_tables_from_page(page_num, flavor='stream')
                else:
                    logger.info(f"No tables found on page {page_num}")
                    return []
            
            extracted_tables = []
            
            for idx, table in enumerate(tables):
                # Get table as dataframe
                df = table.df
                
                # Convert to markdown
                markdown = self._dataframe_to_markdown(df)
                
                # Get accuracy score
                accuracy = table.accuracy if hasattr(table, 'accuracy') else None
                
                extracted_tables.append({
                    "table_index": idx,
                    "page": page_num,
                    "markdown": markdown,
                    "rows": len(df),
                    "cols": len(df.columns),
                    "accuracy": accuracy,
                    "extraction_method": f"camelot_{flavor}",
                    "parsing_report": {
                        "accuracy": accuracy,
                        "whitespace": table.whitespace if hasattr(table, 'whitespace') else None
                    }
                })
            
            logger.info(f"Extracted {len(extracted_tables)} tables from page {page_num} using Camelot ({flavor})")
            return extracted_tables
            
        except Exception as e:
            logger.error(f"Error extracting tables with Camelot from page {page_num}: {e}")
            
            # Try alternative flavor
            if flavor == 'lattice':
                logger.info("Trying stream flavor as fallback")
                return self.extract_tables_from_page(page_num, flavor='stream')
            
            return []
    
    def _dataframe_to_markdown(self, df) -> str:
        """Convert pandas DataFrame to markdown table"""
        try:
            # Use pandas built-in to_markdown if available
            return df.to_markdown(index=False)
        except:
            # Fallback to manual conversion
            markdown_lines = []
            
            # Header
            headers = df.columns.tolist()
            markdown_lines.append("| " + " | ".join(str(h) for h in headers) + " |")
            markdown_lines.append("| " + " | ".join(["---"] * len(headers)) + " |")
            
            # Rows
            for _, row in df.iterrows():
                markdown_lines.append("| " + " | ".join(str(cell) for cell in row) + " |")
            
            return "\n".join(markdown_lines)
    
    def extract_all_tables(self) -> List[Dict[str, Any]]:
        """Extract tables from all pages"""
        all_tables = []
        
        try:
            # Try to extract from all pages at once
            tables = camelot.read_pdf(self.pdf_path, pages='all', flavor='lattice')
            
            if not tables or len(tables) == 0:
                # Try stream flavor
                tables = camelot.read_pdf(self.pdf_path, pages='all', flavor='stream')
            
            for idx, table in enumerate(tables):
                df = table.df
                
                all_tables.append({
                    "table_index": idx,
                    "page": table.page,
                    "markdown": self._dataframe_to_markdown(df),
                    "rows": len(df),
                    "cols": len(df.columns),
                    "accuracy": table.accuracy if hasattr(table, 'accuracy') else None,
                    "extraction_method": "camelot"
                })
            
            logger.info(f"Extracted {len(all_tables)} tables from entire document using Camelot")
            
        except Exception as e:
            logger.error(f"Error extracting all tables with Camelot: {e}")
        
        return all_tables


def extract_tables_camelot(pdf_path: str, page_num: Optional[int] = None) -> List[Dict[str, Any]]:
    """
    Main function to extract tables using Camelot
    
    Args:
        pdf_path: Path to PDF file
        page_num: Specific page number (1-indexed), or None for all pages
        
    Returns:
        List of extracted tables with markdown and metadata
    """
    extractor = CamelotTableExtractor(pdf_path)
    
    if page_num is not None:
        return extractor.extract_tables_from_page(page_num)
    else:
        return extractor.extract_all_tables()
