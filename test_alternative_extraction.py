#!/usr/bin/env python3.11
"""
Comprehensive test script for alternative PDF extraction methods
Tests PyMuPDF, Camelot, Tabula, and unified API
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.app.api.pymupdf_table_extraction import extract_tables_pymupdf
from backend.app.api.camelot_table_extraction import extract_tables_camelot
from backend.app.api.tabula_table_extraction import extract_tables_tabula
from backend.app.api.pymupdf_figure_extraction import extract_figures_pymupdf
from backend.app.api.unified_extraction import UnifiedExtractor

import json
from datetime import datetime

# Test PDF
PDF_PATH = "/home/ubuntu/clinical-study-extraction-app/test_samples/Won2024.pdf"
TEST_PAGE = 4  # Page with large baseline characteristics table

def print_header(title):
    """Print formatted header"""
    print("\n" + "="*80)
    print(f"  {title}")
    print("="*80 + "\n")

def test_pymupdf_tables():
    """Test PyMuPDF table extraction"""
    print_header("TEST 1: PyMuPDF Table Extraction")
    
    try:
        tables = extract_tables_pymupdf(PDF_PATH, page_num=TEST_PAGE)
        print(f"✅ SUCCESS: Found {len(tables)} table(s) on page {TEST_PAGE}")
        
        for i, table in enumerate(tables):
            print(f"\n  Table {i+1}:")
            print(f"    - Rows: {table.get('rows')}")
            print(f"    - Columns: {table.get('cols')}")
            print(f"    - Method: {table.get('extraction_method')}")
            print(f"    - Markdown length: {len(table.get('markdown', ''))} chars")
            
        return True, tables
    except Exception as e:
        print(f"❌ FAILED: {e}")
        return False, []

def test_camelot_tables():
    """Test Camelot table extraction"""
    print_header("TEST 2: Camelot Table Extraction")
    
    try:
        tables = extract_tables_camelot(PDF_PATH, page_num=TEST_PAGE)
        print(f"✅ SUCCESS: Found {len(tables)} table(s) on page {TEST_PAGE}")
        
        for i, table in enumerate(tables):
            print(f"\n  Table {i+1}:")
            print(f"    - Rows: {table.get('rows')}")
            print(f"    - Columns: {table.get('cols')}")
            print(f"    - Method: {table.get('extraction_method')}")
            print(f"    - Accuracy: {table.get('accuracy', 'N/A')}")
            print(f"    - Markdown length: {len(table.get('markdown', ''))} chars")
            
        return True, tables
    except Exception as e:
        print(f"❌ FAILED: {e}")
        return False, []

def test_tabula_tables():
    """Test Tabula table extraction"""
    print_header("TEST 3: Tabula Table Extraction")
    
    try:
        tables = extract_tables_tabula(PDF_PATH, page_num=TEST_PAGE)
        print(f"✅ SUCCESS: Found {len(tables)} table(s) on page {TEST_PAGE}")
        
        for i, table in enumerate(tables):
            print(f"\n  Table {i+1}:")
            print(f"    - Rows: {table.get('rows')}")
            print(f"    - Columns: {table.get('cols')}")
            print(f"    - Method: {table.get('extraction_method')}")
            print(f"    - Markdown length: {len(table.get('markdown', ''))} chars")
            
        return True, tables
    except Exception as e:
        print(f"❌ FAILED: {e}")
        return False, []

def test_unified_tables():
    """Test unified table extraction with fallback"""
    print_header("TEST 4: Unified Table Extraction (with Fallback)")
    
    try:
        result = UnifiedExtractor.extract_tables(PDF_PATH, page_num=TEST_PAGE)
        
        if result['success']:
            print(f"✅ SUCCESS: Extracted {result['table_count']} table(s)")
            print(f"    - Method used: {result['method_used']}")
            print(f"    - Methods tried: {', '.join(result['methods_tried'])}")
            
            for i, table in enumerate(result['tables']):
                print(f"\n  Table {i+1}:")
                print(f"    - Rows: {table.get('rows')}")
                print(f"    - Columns: {table.get('cols')}")
                print(f"    - Markdown length: {len(table.get('markdown', ''))} chars")
        else:
            print(f"❌ FAILED: {result['errors']}")
            
        return result['success'], result
    except Exception as e:
        print(f"❌ FAILED: {e}")
        return False, {}

def test_pymupdf_figures():
    """Test PyMuPDF figure extraction"""
    print_header("TEST 5: PyMuPDF Figure Extraction")
    
    try:
        figures = extract_figures_pymupdf(PDF_PATH, page_num=None, min_width=50, min_height=50)
        print(f"✅ SUCCESS: Found {len(figures)} figure(s) in entire document")
        
        # Group by page
        pages_with_figures = {}
        for fig in figures:
            page = fig.get('page')
            if page not in pages_with_figures:
                pages_with_figures[page] = []
            pages_with_figures[page].append(fig)
        
        print(f"\n  Figures by page:")
        for page in sorted(pages_with_figures.keys()):
            figs = pages_with_figures[page]
            print(f"    - Page {page}: {len(figs)} figure(s)")
            for i, fig in enumerate(figs[:3]):  # Show first 3 per page
                print(f"      • Figure {i+1}: {fig.get('format')} {fig.get('width')}x{fig.get('height')}")
        
        return True, figures
    except Exception as e:
        print(f"❌ FAILED: {e}")
        return False, []

def test_unified_figures():
    """Test unified figure extraction"""
    print_header("TEST 6: Unified Figure Extraction")
    
    try:
        result = UnifiedExtractor.extract_figures(PDF_PATH, page_num=6)  # Page 6 has figures
        
        if result['success']:
            print(f"✅ SUCCESS: Extracted {result['figure_count']} figure(s)")
            print(f"    - Method used: {result['method_used']}")
            print(f"    - Methods tried: {', '.join(result['methods_tried'])}")
            
            for i, fig in enumerate(result['figures'][:5]):
                print(f"\n  Figure {i+1}:")
                print(f"    - Format: {fig.get('format')}")
                print(f"    - Size: {fig.get('width')}x{fig.get('height')}")
                print(f"    - Size (bytes): {fig.get('size_bytes')}")
        else:
            print(f"❌ FAILED: {result['errors']}")
            
        return result['success'], result
    except Exception as e:
        print(f"❌ FAILED: {e}")
        return False, {}

def generate_report(results):
    """Generate test report"""
    print_header("TEST SUMMARY REPORT")
    
    total_tests = len(results)
    passed_tests = sum(1 for success, _ in results.values() if success)
    
    print(f"Total Tests: {total_tests}")
    print(f"Passed: {passed_tests}")
    print(f"Failed: {total_tests - passed_tests}")
    print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
    
    print("\n\nDetailed Results:")
    for test_name, (success, data) in results.items():
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"  {status} - {test_name}")
    
    # Save report to file
    report = {
        "timestamp": datetime.now().isoformat(),
        "pdf_tested": PDF_PATH,
        "test_page": TEST_PAGE,
        "total_tests": total_tests,
        "passed": passed_tests,
        "failed": total_tests - passed_tests,
        "success_rate": f"{(passed_tests/total_tests)*100:.1f}%",
        "results": {
            name: {
                "success": success,
                "data_summary": str(data)[:500] if data else None
            }
            for name, (success, data) in results.items()
        }
    }
    
    report_path = "/home/ubuntu/clinical-study-extraction-app/ALTERNATIVE_EXTRACTION_TEST_REPORT.json"
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=2)
    
    print(f"\n\n📄 Full report saved to: {report_path}")

def main():
    """Run all tests"""
    print("\n" + "🧪 " * 40)
    print("  ALTERNATIVE PDF EXTRACTION METHODS - COMPREHENSIVE TEST SUITE")
    print("🧪 " * 40)
    
    results = {}
    
    # Run all tests
    results["PyMuPDF Tables"] = test_pymupdf_tables()
    results["Camelot Tables"] = test_camelot_tables()
    results["Tabula Tables"] = test_tabula_tables()
    results["Unified Tables"] = test_unified_tables()
    results["PyMuPDF Figures"] = test_pymupdf_figures()
    results["Unified Figures"] = test_unified_figures()
    
    # Generate report
    generate_report(results)
    
    print("\n\n✅ All tests completed!")

if __name__ == "__main__":
    main()
