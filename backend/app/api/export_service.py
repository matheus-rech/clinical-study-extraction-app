"""
Export Service for Clinical Study Extraction App
Provides table exports (CSV, Excel, JSON) and annotated PDF generation
"""

import io
import json
import csv
from typing import List, Dict, Any, Optional
import logging
import fitz  # PyMuPDF
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill
from fastapi import APIRouter, UploadFile, File, HTTPException, Response
import tempfile
from pathlib import Path

logger = logging.getLogger(__name__)
router = APIRouter()

class TableExporter:
    @staticmethod
    def to_csv(tables: List[Dict[str, Any]]) -> str:
        output = io.StringIO()
        writer = csv.writer(output)
        
        for idx, table in enumerate(tables):
            writer.writerow([f"=== Table {idx + 1} ==="])
            writer.writerow([f"Page: {table.get('page', 'N/A')}"])
            writer.writerow([])
            
            markdown = table.get('markdown', '')
            if markdown:
                for line in markdown.split('\n'):
                    if line.strip() and not line.strip().startswith('|---'):
                        cells = [c.strip() for c in line.strip('|').split('|')]
                        writer.writerow(cells)
            writer.writerow([])
        
        return output.getvalue()
    
    @staticmethod
    def to_excel(tables: List[Dict[str, Any]]) -> bytes:
        wb = Workbook()
        wb.remove(wb.active)
        
        for idx, table in enumerate(tables):
            ws = wb.create_sheet(title=f"Table_{idx+1}")
            ws['A1'] = f"Table {idx + 1} - Page {table.get('page', 'N/A')}"
            ws['A1'].font = Font(bold=True, size=14)
            
            markdown = table.get('markdown', '')
            if markdown:
                row = 3
                for line in markdown.split('\n'):
                    if line.strip() and not line.strip().startswith('|---'):
                        cells = [c.strip() for c in line.strip('|').split('|')]
                        for col, cell in enumerate(cells, 1):
                            ws.cell(row=row, column=col, value=cell)
                        row += 1
        
        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        return output.getvalue()

class PDFAnnotator:
    @staticmethod
    def annotate_pdf(pdf_path: str, tables: List[Dict], figures: List[Dict] = None) -> bytes:
        doc = fitz.open(pdf_path)
        
        # Annotate tables
        for table in tables:
            page_num = table.get('page', 1) - 1
            if 0 <= page_num < len(doc):
                page = doc[page_num]
                bbox = table.get('bbox')
                if bbox:
                    rect = fitz.Rect(bbox['x0'], bbox['y0'], bbox['x1'], bbox['y1'])
                    page.draw_rect(rect, color=(0, 0, 1), width=2)
                    page.insert_text(
                        (rect.x0, rect.y0 - 5),
                        f"Table {table.get('table_index', 0) + 1}",
                        fontsize=10,
                        color=(0, 0, 1)
                    )
        
        output = io.BytesIO()
        doc.save(output)
        doc.close()
        output.seek(0)
        return output.getvalue()

@router.post("/api/export/tables/csv")
async def export_csv(tables: List[Dict[str, Any]]):
    csv_content = TableExporter.to_csv(tables)
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=tables.csv"}
    )

@router.post("/api/export/tables/excel")
async def export_excel(tables: List[Dict[str, Any]]):
    excel_content = TableExporter.to_excel(tables)
    return Response(
        content=excel_content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=tables.xlsx"}
    )

@router.post("/api/export/pdf/annotated")
async def export_annotated(file: UploadFile = File(...), tables: str = "[]"):
    tables_data = json.loads(tables)
    
    with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp:
        content = await file.read()
        temp.write(content)
        temp_path = temp.name
    
    annotated = PDFAnnotator.annotate_pdf(temp_path, tables_data)
    Path(temp_path).unlink()
    
    return Response(
        content=annotated,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=annotated_{file.filename}"}
    )
