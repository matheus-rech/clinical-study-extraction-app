"""
Tabula-based table extraction module
Java-based table extraction with good accuracy for various PDF formats
"""
import tabula
from typing import List, Dict, Any, Optional
import logging
import pandas as pd

logger = logging.getLogger(__name__)


class TabulaTableExtractor:
    """Extract tables using Tabula library"""
    
    def __init__(self, pdf_path: str):
        self.pdf_path = pdf_path
    
    def extract_tables_from_page(self, page_num: int) -> List[Dict[str, Any]]:
        """
        Extract tables from a specific page using Tabula
        
        Args:
            page_num: Page number (1-indexed)
            
        Returns:
            List of table dictionaries with markdown and metadata
        """
        try:
            # Extract tables as DataFrames
            dfs = tabula.read_pdf(
                self.pdf_path,
                pages=page_num,
                multiple_tables=True,
                pandas_options={'header': None}  # Let Tabula detect headers
            )
            
            if not dfs or len(dfs) == 0:
                logger.info(f"No tables found on page {page_num} with Tabula")
                return []
            
            extracted_tables = []
            
            for idx, df in enumerate(dfs):
                # Skip empty dataframes
                if df.empty:
                    continue
                
                # Convert to markdown
                markdown = self._dataframe_to_markdown(df)
                
                extracted_tables.append({
                    "table_index": idx,
                    "page": page_num,
                    "markdown": markdown,
                    "rows": len(df),
                    "cols": len(df.columns),
                    "extraction_method": "tabula"
                })
            
            logger.info(f"Extracted {len(extracted_tables)} tables from page {page_num} using Tabula")
            return extracted_tables
            
        except Exception as e:
            logger.error(f"Error extracting tables with Tabula from page {page_num}: {e}")
            return []
    
    def _dataframe_to_markdown(self, df: pd.DataFrame) -> str:
        """Convert pandas DataFrame to markdown table"""
        try:
            # Clean up the dataframe
            df = df.fillna('')  # Replace NaN with empty string
            
            # Try to use first row as header if it looks like headers
            if len(df) > 0:
                first_row = df.iloc[0]
                if all(isinstance(val, str) and val.strip() for val in first_row):
                    # First row looks like headers
                    df.columns = first_row
                    df = df[1:]
            
            markdown_lines = []
            
            # Header
            headers = [str(h) for h in df.columns]
            markdown_lines.append("| " + " | ".join(headers) + " |")
            markdown_lines.append("| " + " | ".join(["---"] * len(headers)) + " |")
            
            # Rows
            for _, row in df.iterrows():
                cells = [str(cell).strip() for cell in row]
                markdown_lines.append("| " + " | ".join(cells) + " |")
            
            return "\n".join(markdown_lines)
            
        except Exception as e:
            logger.error(f"Error converting DataFrame to markdown: {e}")
            return str(df)
    
    def extract_all_tables(self) -> List[Dict[str, Any]]:
        """Extract tables from all pages"""
        all_tables = []
        
        try:
            # Extract from all pages
            dfs = tabula.read_pdf(
                self.pdf_path,
                pages='all',
                multiple_tables=True,
                pandas_options={'header': None}
            )
            
            for idx, df in enumerate(dfs):
                if df.empty:
                    continue
                
                all_tables.append({
                    "table_index": idx,
                    "page": "unknown",  # Tabula doesn't provide page info in batch mode
                    "markdown": self._dataframe_to_markdown(df),
                    "rows": len(df),
                    "cols": len(df.columns),
                    "extraction_method": "tabula"
                })
            
            logger.info(f"Extracted {len(all_tables)} tables from entire document using Tabula")
            
        except Exception as e:
            logger.error(f"Error extracting all tables with Tabula: {e}")
        
        return all_tables


def extract_tables_tabula(pdf_path: str, page_num: Optional[int] = None) -> List[Dict[str, Any]]:
    """
    Main function to extract tables using Tabula
    
    Args:
        pdf_path: Path to PDF file
        page_num: Specific page number (1-indexed), or None for all pages
        
    Returns:
        List of extracted tables with markdown and metadata
    """
    extractor = TabulaTableExtractor(pdf_path)
    
    if page_num is not None:
        return extractor.extract_tables_from_page(page_num)
    else:
        return extractor.extract_all_tables()
