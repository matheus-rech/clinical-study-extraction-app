"""
PDF Manipulation Module

Provides utilities for PDF operations like merging, splitting, rotating,
watermarking, encryption, and metadata extraction.
"""

import io
from typing import List, Optional, Tuple, Dict
from pypdf import PdfReader, PdfWriter, PdfMerger
class PDFManipulator:
    """Utility class for PDF manipulation operations"""

    def merge_pdfs(self, pdf_bytes_list: List[bytes]) -> bytes:
        """
        Merge multiple PDFs into a single PDF

        Args:
            pdf_bytes_list: List of PDF files as bytes

        Returns:
            Merged PDF as bytes
        """
        merger = PdfMerger()

        for pdf_bytes in pdf_bytes_list:
            pdf_file = io.BytesIO(pdf_bytes)
            merger.append(pdf_file)

        output = io.BytesIO()
        merger.write(output)
        merger.close()
        output.seek(0)

        return output.read()

    def split_pdf(
        self,
        pdf_bytes: bytes,
        page_ranges: Optional[List[Tuple[int, int]]] = None
    ) -> Dict[str, bytes]:
        """
        Split PDF into multiple files

        Args:
            pdf_bytes: PDF file as bytes
            page_ranges: List of (start, end) page tuples. If None, splits into individual pages

        Returns:
            Dictionary with filenames as keys and PDF bytes as values
        """
        reader = PdfReader(io.BytesIO(pdf_bytes))
        total_pages = len(reader.pages)
        results = {}

        if page_ranges is None:
            # Split into individual pages
            for i in range(total_pages):
                writer = PdfWriter()
                writer.add_page(reader.pages[i])

                output = io.BytesIO()
                writer.write(output)
                output.seek(0)

                results[f"page_{i+1}.pdf"] = output.read()
        else:
            # Split according to specified ranges
            for idx, (start, end) in enumerate(page_ranges):
                writer = PdfWriter()

                # Adjust for 0-indexing
                start_idx = start - 1
                end_idx = min(end, total_pages)

                for i in range(start_idx, end_idx):
                    writer.add_page(reader.pages[i])

                output = io.BytesIO()
                writer.write(output)
                output.seek(0)

                results[f"pages_{start}-{end}.pdf"] = output.read()

        return results

    def rotate_pages(
        self,
        pdf_bytes: bytes,
        rotation: int = 90,
        page_numbers: Optional[List[int]] = None
    ) -> bytes:
        """
        Rotate pages in a PDF

        Args:
            pdf_bytes: PDF file as bytes
            rotation: Angle to rotate (90, 180, 270)
            page_numbers: List of page numbers to rotate (1-indexed). If None, rotates all pages

        Returns:
            Rotated PDF as bytes
        """
        reader = PdfReader(io.BytesIO(pdf_bytes))
        writer = PdfWriter()

        total_pages = len(reader.pages)
        pages_to_rotate = set(page_numbers) if page_numbers else set(range(1, total_pages + 1))

        for i in range(total_pages):
            page = reader.pages[i]
            if (i + 1) in pages_to_rotate:
                page.rotate(rotation)
            writer.add_page(page)

        output = io.BytesIO()
        writer.write(output)
        output.seek(0)

        return output.read()

    def extract_metadata(self, pdf_bytes: bytes) -> Dict:
        """
        Extract PDF metadata

        Args:
            pdf_bytes: PDF file as bytes

        Returns:
            Dictionary containing metadata
        """
        reader = PdfReader(io.BytesIO(pdf_bytes))
        metadata = reader.metadata

        result = {
            'title': metadata.get('/Title', 'Unknown'),
            'author': metadata.get('/Author', 'Unknown'),
            'subject': metadata.get('/Subject', ''),
            'creator': metadata.get('/Creator', ''),
            'producer': metadata.get('/Producer', ''),
            'creation_date': metadata.get('/CreationDate', ''),
            'modification_date': metadata.get('/ModDate', ''),
            'page_count': len(reader.pages)
        }

        return result

    def add_watermark(self, pdf_bytes: bytes, watermark_text: str) -> bytes:
        """
        Add text watermark to PDF.

        NOTE: This function is a placeholder and is not implemented.
        A proper implementation requires the reportlab library to create a watermark overlay.
        Currently, this function raises NotImplementedError.

        Args:
            pdf_bytes: PDF file as bytes
            watermark_text: Text to use as watermark

        Returns:
            Watermarked PDF as bytes

        Raises:
            NotImplementedError: This function is not implemented.
        """
        raise NotImplementedError(
            "add_watermark is not implemented. Use reportlab to create a watermark overlay."
        )

    def encrypt_pdf(self, pdf_bytes: bytes, password: str) -> bytes:
        """
        Add password protection to PDF

        Args:
            pdf_bytes: PDF file as bytes
            password: Password to protect the PDF

        Returns:
            Encrypted PDF as bytes
        """
        reader = PdfReader(io.BytesIO(pdf_bytes))
        writer = PdfWriter()

        for page in reader.pages:
            writer.add_page(page)

        writer.encrypt(password)

        output = io.BytesIO()
        writer.write(output)
        output.seek(0)

        return output.read()

    def decrypt_pdf(self, pdf_bytes: bytes, password: str) -> bytes:
        """
        Remove password protection from PDF

        Args:
            pdf_bytes: PDF file as bytes
            password: Password to decrypt the PDF

        Returns:
            Decrypted PDF as bytes
        """
        reader = PdfReader(io.BytesIO(pdf_bytes))

        if reader.is_encrypted:
            reader.decrypt(password)

        writer = PdfWriter()
        for page in reader.pages:
            writer.add_page(page)

        output = io.BytesIO()
        writer.write(output)
        output.seek(0)

        return output.read()

    def extract_images_from_pdf(self, pdf_bytes: bytes) -> List[Dict]:
        """
        Extract embedded images from PDF

        Args:
            pdf_bytes: PDF file as bytes

        Returns:
            List of dictionaries containing image data
        """
        reader = PdfReader(io.BytesIO(pdf_bytes))
        images = []

        for page_num, page in enumerate(reader.pages, 1):
            if '/Resources' in page and '/XObject' in page['/Resources']:
                xobjects = page['/Resources']['/XObject'].get_object()

                for obj_name in xobjects:
                    obj = xobjects[obj_name]

                    if obj['/Subtype'] == '/Image':
                        try:
                            # Extract image data
                            size = (obj['/Width'], obj['/Height'])
                            data = obj.get_data()

                            # Determine format
                            if '/Filter' in obj:
                                filter_type = obj['/Filter']
                                if filter_type == '/DCTDecode':
                                    format_type = 'JPEG'
                                elif filter_type == '/FlateDecode':
                                    format_type = 'PNG'
                                else:
                                    format_type = 'Unknown'
                            else:
                                format_type = 'Unknown'

                            images.append({
                                'page': page_num,
                                'name': str(obj_name),
                                'size': size,
                                'format': format_type,
                                'data': data
                            })
                        except Exception as e:
                            # Skip images that can't be extracted
                            logger.warning(f'Failed to extract image {obj_name} from page {page_num}: {e}')
                            continue

        return images
