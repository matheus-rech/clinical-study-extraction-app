"""
olmOCR-based table and figure extraction using external inference provider (DeepInfra)

This module provides integration with Allen AI's olmOCR vision language model
for extracting tables and figures from PDF documents. It uses an external API
provider (DeepInfra) to avoid GPU requirements.

Author: Manus AI
Date: November 8, 2025
"""

from openai import OpenAI
import base64
import io
import re
import os
import time
from typing import List, Dict, Any, Optional
from PIL import Image
import fitz  # PyMuPDF for PDF to image conversion
import logging
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)


class OlmOCRExtractor:
    """
    Extract tables and figures from PDFs using olmOCR Vision Language Model
    
    This class interfaces with external inference providers (DeepInfra, Parasail, Cirrascale)
    to run olmOCR without requiring local GPU resources.
    """
    
    # API endpoints for different providers
    ENDPOINTS = {
        "deepinfra": "https://api.deepinfra.com/v1/openai/chat/completions",
        "parasail": "https://api.parasail.io/v1/chat/completions",
        "cirrascale": "https://ai2endpoints.cirrascale.ai/api/chat/completions"
    }
    
    # Model names for different providers
    MODELS = {
        "deepinfra": "allenai/olmOCR-2-7B-1025",
        "parasail": "allenai/olmOCR-2-7B-1025",
        "cirrascale": "olmOCR-2-7B-1025"
    }
    
    def __init__(self, api_key: str, provider: str = "deepinfra", timeout: int = 60, max_retries: int = 2):
        """
        Initialize olmOCR extractor
        
        Args:
            api_key: API key for the inference provider
            provider: Provider name ('deepinfra', 'parasail', 'cirrascale')
            timeout: Request timeout in seconds
            max_retries: Maximum number of retry attempts
        """
        if not api_key:
            raise ValueError("API key is required for olmOCR extraction")
        
        if provider not in self.ENDPOINTS:
            raise ValueError(f"Unknown provider: {provider}. Must be one of {list(self.ENDPOINTS.keys())}")
        
        self.api_key = api_key
        self.provider = provider
        self.endpoint = self.ENDPOINTS[provider]
        self.model = self.MODELS[provider]
        self.timeout = timeout
        self.max_retries = max_retries
        
        logger.info(f"Initialized olmOCR extractor with provider: {provider}")
    
    def pdf_page_to_base64(self, pdf_path: str, page_num: int, dpi: int = 150) -> str:
        """
        Convert a PDF page to base64-encoded PNG image
        
        Args:
            pdf_path: Path to PDF file
            page_num: Page number (0-indexed)
            dpi: Resolution for rendering (default: 150)
            
        Returns:
            Base64-encoded PNG image string
        """
        try:
            doc = fitz.open(pdf_path)
            
            if page_num < 0 or page_num >= len(doc):
                raise ValueError(f"Page number {page_num} out of range (0-{len(doc)-1})")
            
            page = doc[page_num]
            
            # Render page to image at specified DPI
            mat = fitz.Matrix(dpi/72, dpi/72)
            pix = page.get_pixmap(matrix=mat)
            
            # Convert to PIL Image
            img_data = pix.tobytes("png")
            img = Image.open(io.BytesIO(img_data))
            
            # Convert to base64
            buffer = io.BytesIO()
            img.save(buffer, format='PNG')
            img_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
            
            doc.close()
            
            logger.debug(f"Converted page {page_num + 1} to base64 image ({len(img_base64)} bytes)")
            return img_base64
            
        except Exception as e:
            logger.error(f"Failed to convert PDF page to image: {e}")
            raise
    
    def extract_via_api(self, pdf_path: str, page_num: int, task: str = "tables") -> str:
        """
        Call olmOCR API to extract content from a PDF page
        
        Args:
            pdf_path: Path to PDF file
            page_num: Page number (0-indexed)
            task: Extraction task ('tables', 'figures', 'all')
            
        Returns:
            Markdown-formatted extraction result
        """
        # Task-specific prompts
        prompts = {
            "tables": "Extract all tables from this page in markdown format. Preserve table structure and content accurately. Include table titles if present.",
            "figures": "Extract all figures and their captions from this page. Describe what each figure shows and include the caption text.",
            "all": "Extract all content from this page in markdown format, including tables, figures, and text. Preserve the document structure."
        }
        
        prompt = prompts.get(task, prompts["all"])
        
        # Convert PDF page to image
        start_time = time.time()
        img_base64 = self.pdf_page_to_base64(pdf_path, page_num)
        conversion_time = time.time() - start_time
        logger.debug(f"PDF to image conversion took {conversion_time:.2f}s")
        
        # Create OpenAI client
        client = OpenAI(
            api_key=self.api_key,
            base_url=self.endpoint.replace("/chat/completions", "")
        )
        
        # Make API request with retries
        for attempt in range(self.max_retries + 1):
            try:
                api_start_time = time.time()
                
                chat_completion = client.chat.completions.create(
                    model=self.model,
                    max_tokens=4096,
                    temperature=0.0,
                    messages=[
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "image_url",
                                    "image_url": {
                                        "url": f"data:image/png;base64,{img_base64}"
                                    }
                                },
                                {
                                    "type": "text",
                                    "text": prompt
                                }
                            ]
                        }
                    ]
                )
                
                api_duration = time.time() - api_start_time
                markdown_output = chat_completion.choices[0].message.content
                
                total_duration = time.time() - start_time
                logger.info(f"olmOCR extraction successful: page={page_num + 1}, "
                           f"api_time={api_duration:.2f}s, total_time={total_duration:.2f}s, "
                           f"tokens={chat_completion.usage.prompt_tokens}/{chat_completion.usage.completion_tokens}")
                
                return markdown_output
                
            except Exception as e:
                error_str = str(e)
                logger.warning(f"olmOCR API error (attempt {attempt + 1}/{self.max_retries + 1}): {error_str}")
                
                # Check for specific error types
                if "timeout" in error_str.lower():
                    if attempt == self.max_retries:
                        raise Exception(f"olmOCR API timeout after {self.max_retries + 1} attempts")
                    time.sleep(2 ** attempt)
                elif "429" in error_str or "rate" in error_str.lower():
                    if attempt < self.max_retries:
                        wait_time = 2 ** (attempt + 1)
                        logger.warning(f"Rate limited, waiting {wait_time}s before retry")
                        time.sleep(wait_time)
                        continue
                    else:
                        raise Exception("olmOCR API rate limit exceeded")
                elif "401" in error_str or "authentication" in error_str.lower():
                    raise Exception("olmOCR API authentication failed - check API key")
                elif attempt == self.max_retries:
                    raise
                else:
                    time.sleep(2 ** attempt)
    
    def parse_html_tables(self, html_content: str, page_num: int) -> List[Dict[str, Any]]:
        """
        Parse HTML tables into structured format
        
        Args:
            html_content: HTML text containing tables
            page_num: Page number (0-indexed)
            
        Returns:
            List of table dictionaries
        """
        tables = []
        
        try:
            soup = BeautifulSoup(html_content, 'html.parser')
            html_tables = soup.find_all('table')
            
            for table_idx, html_table in enumerate(html_tables):
                # Extract table rows
                rows = html_table.find_all('tr')
                if not rows:
                    continue
                
                # Convert HTML table to markdown
                markdown_rows = []
                max_cols = 0
                
                for row in rows:
                    cells = row.find_all(['td', 'th'])
                    if cells:
                        # Get cell text and handle colspan
                        row_data = []
                        for cell in cells:
                            text = cell.get_text(strip=True)
                            colspan = int(cell.get('colspan', 1))
                            row_data.append(text)
                            # Add empty cells for colspan
                            for _ in range(colspan - 1):
                                row_data.append('')
                        
                        markdown_rows.append('| ' + ' | '.join(row_data) + ' |')
                        max_cols = max(max_cols, len(row_data))
                
                if not markdown_rows:
                    continue
                
                # Add separator after first row (header)
                if len(markdown_rows) > 1:
                    separator = '| ' + ' | '.join(['---'] * max_cols) + ' |'
                    markdown_rows.insert(1, separator)
                
                table_markdown = '\n'.join(markdown_rows)
                
                # Look for table title before the table
                title = None
                prev_sibling = html_table.find_previous_sibling()
                if prev_sibling and prev_sibling.name in ['p', 'div', 'h1', 'h2', 'h3', 'h4']:
                    title_text = prev_sibling.get_text(strip=True)
                    if 'table' in title_text.lower():
                        title = title_text
                
                table_data = {
                    "table_index": len(tables),
                    "page": page_num + 1,
                    "markdown": table_markdown,
                    "rows": len(markdown_rows) - 1,  # Exclude separator
                    "cols": max_cols,
                    "extraction_method": "olmocr_vlm",
                    "title": title
                }
                
                tables.append(table_data)
                logger.debug(f"Parsed HTML table: {len(markdown_rows)-1} rows × {max_cols} cols")
        
        except Exception as e:
            logger.error(f"Failed to parse HTML tables: {e}")
        
        logger.info(f"Parsed {len(tables)} HTML table(s)")
        return tables
    
    def parse_tables_from_markdown(self, markdown: str, page_num: int) -> List[Dict[str, Any]]:
        """
        Parse markdown tables into structured format
        
        Args:
            markdown: Markdown text containing tables
            page_num: Page number (0-indexed)
            
        Returns:
            List of table dictionaries
        """
        tables = []
        lines = markdown.split('\n')
        current_table = []
        in_table = False
        table_title = None
        
        for i, line in enumerate(lines):
            # Check if line contains table delimiter
            if '|' in line:
                if not in_table:
                    # Starting new table
                    in_table = True
                    current_table = []
                    
                    # Look for table title in previous lines
                    for j in range(max(0, i - 3), i):
                        prev_line = lines[j].strip()
                        if prev_line and not prev_line.startswith('|'):
                            # Potential title
                            if 'table' in prev_line.lower() or 'Table' in prev_line:
                                table_title = prev_line
                                break
                
                current_table.append(line)
            else:
                if in_table and current_table:
                    # End of table, process it
                    table_markdown = '\n'.join(current_table)
                    
                    # Parse table dimensions
                    rows = [r for r in current_table if r.strip() and not r.strip().startswith('|---')]
                    if rows:
                        cols = len([c for c in rows[0].split('|') if c.strip()])
                        
                        table_data = {
                            "table_index": len(tables),
                            "page": page_num + 1,
                            "markdown": table_markdown,
                            "rows": len(rows),
                            "cols": cols,
                            "extraction_method": "olmocr_vlm",
                            "title": table_title
                        }
                        
                        tables.append(table_data)
                        logger.debug(f"Parsed table: {len(rows)} rows × {cols} cols")
                    
                    current_table = []
                    in_table = False
                    table_title = None
        
        # Handle table at end of markdown
        if in_table and current_table:
            table_markdown = '\n'.join(current_table)
            rows = [r for r in current_table if r.strip() and not r.strip().startswith('|---')]
            if rows:
                cols = len([c for c in rows[0].split('|') if c.strip()])
                
                table_data = {
                    "table_index": len(tables),
                    "page": page_num + 1,
                    "markdown": table_markdown,
                    "rows": len(rows),
                    "cols": cols,
                    "extraction_method": "olmocr_vlm",
                    "title": table_title
                }
                
                tables.append(table_data)
        
        logger.info(f"Parsed {len(tables)} table(s) from markdown")
        return tables
    
    def extract_tables(self, pdf_path: str, page_num: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Extract tables from PDF using olmOCR
        
        Args:
            pdf_path: Path to PDF file
            page_num: Specific page number (0-indexed), or None for all pages
            
        Returns:
            List of extracted tables
        """
        all_tables = []
        
        if page_num is not None:
            # Extract from specific page
            try:
                output = self.extract_via_api(pdf_path, page_num, task="tables")
                
                # Try HTML parsing first (olmOCR often returns HTML tables)
                if '<table' in output:
                    tables = self.parse_html_tables(output, page_num)
                else:
                    # Fall back to markdown parsing
                    tables = self.parse_tables_from_markdown(output, page_num)
                
                all_tables.extend(tables)
            except Exception as e:
                logger.error(f"Failed to extract from page {page_num + 1}: {e}")
                raise
        else:
            # Extract from all pages
            doc = fitz.open(pdf_path)
            total_pages = len(doc)
            doc.close()
            
            logger.info(f"Extracting tables from all {total_pages} pages")
            
            for page_idx in range(total_pages):
                try:
                    output = self.extract_via_api(pdf_path, page_idx, task="tables")
                    
                    # Try HTML parsing first
                    if '<table' in output:
                        tables = self.parse_html_tables(output, page_idx)
                    else:
                        tables = self.parse_tables_from_markdown(output, page_idx)
                    
                    all_tables.extend(tables)
                except Exception as e:
                    logger.warning(f"Failed to extract from page {page_idx + 1}: {e}")
                    # Continue with other pages
        
        logger.info(f"Total tables extracted: {len(all_tables)}")
        return all_tables


def extract_tables_olmocr(pdf_path: str, page_num: Optional[int] = None, 
                          api_key: Optional[str] = None, 
                          provider: str = "deepinfra") -> List[Dict[str, Any]]:
    """
    Main function to extract tables using olmOCR
    
    This is the public API function that should be called by the unified extraction system.
    
    Args:
        pdf_path: Path to PDF file
        page_num: Specific page number (1-indexed), or None for all pages
        api_key: API key for inference provider (required)
        provider: Inference provider ('deepinfra', 'parasail', 'cirrascale')
        
    Returns:
        List of extracted tables with metadata
        
    Raises:
        ValueError: If API key is not provided
        Exception: If extraction fails
        
    Example:
        >>> tables = extract_tables_olmocr("document.pdf", page_num=4, api_key="your_key")
        >>> print(f"Extracted {len(tables)} tables")
        >>> print(tables[0]["markdown"])
    """
    # Get API key from environment if not provided
    if not api_key:
        api_key = os.getenv("OLMOCR_API_KEY")
    
    if not api_key:
        raise ValueError("olmOCR API key required. Provide via api_key parameter or OLMOCR_API_KEY environment variable.")
    
    # Get provider from environment if not specified
    if not provider:
        provider = os.getenv("OLMOCR_PROVIDER", "deepinfra")
    
    # Create extractor
    extractor = OlmOCRExtractor(api_key, provider)
    
    # Convert to 0-indexed if page_num provided
    page_idx = (page_num - 1) if page_num is not None else None
    
    # Extract tables
    return extractor.extract_tables(pdf_path, page_idx)


# Example usage
if __name__ == "__main__":
    import sys
    
    # Simple CLI for testing
    if len(sys.argv) < 2:
        print("Usage: python olmocr_extraction.py <pdf_path> [page_num]")
        print("Example: python olmocr_extraction.py document.pdf 4")
        print("\nRequires OLMOCR_API_KEY environment variable to be set")
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    page_num = int(sys.argv[2]) if len(sys.argv) > 2 else None
    
    # Configure logging
    logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
    
    try:
        tables = extract_tables_olmocr(pdf_path, page_num)
        
        print(f"\n{'='*80}")
        print(f"olmOCR Extraction Results")
        print(f"{'='*80}")
        print(f"PDF: {pdf_path}")
        print(f"Page: {page_num if page_num else 'All'}")
        print(f"Tables found: {len(tables)}")
        print(f"{'='*80}\n")
        
        for i, table in enumerate(tables):
            print(f"\nTable {i + 1}:")
            print(f"  Page: {table['page']}")
            print(f"  Dimensions: {table['rows']} rows × {table['cols']} cols")
            print(f"  Title: {table.get('title', 'N/A')}")
            print(f"  Method: {table['extraction_method']}")
            print(f"\n  Markdown preview:")
            print(f"  {table['markdown'][:200]}...")
            
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)
