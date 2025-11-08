"""
Comprehensive test script for olmOCR integration
Tests all extraction methods and compares results
"""
import os
import sys
import time
import json
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent / "backend"))

from app.api.pymupdf_table_extraction import extract_tables_pymupdf
from app.api.camelot_table_extraction import extract_tables_camelot
from app.api.tabula_table_extraction import extract_tables_tabula
from app.api.olmocr_extraction import extract_tables_olmocr
from app.api.unified_extraction import UnifiedExtractor

# Test configuration
PDF_PATH = "test_samples/Won2024.pdf"
TEST_PAGE = 4  # Page with baseline characteristics table

def print_header(title):
    """Print formatted header"""
    print("\n" + "="*80)
    print(f"  {title}")
    print("="*80 + "\n")

def print_table_info(tables, method_name):
    """Print information about extracted tables"""
    if not tables:
        print(f"  ❌ No tables found")
        return
    
    print(f"  ✅ Found {len(tables)} table(s)")
    for i, table in enumerate(tables):
        print(f"\n  Table {i+1}:")
        print(f"    Page: {table.get('page', 'N/A')}")
        print(f"    Dimensions: {table.get('rows', 'N/A')} rows × {table.get('cols', 'N/A')} cols")
        print(f"    Method: {table.get('extraction_method', method_name)}")
        
        if 'title' in table and table['title']:
            print(f"    Title: {table['title']}")
        
        # Show markdown preview
        if 'markdown' in table:
            preview = table['markdown'][:150].replace('\n', ' ')
            print(f"    Preview: {preview}...")
        
        # Show accuracy if available
        if 'accuracy' in table:
            print(f"    Accuracy: {table['accuracy']:.2f}%")

def test_method(method_name, extract_func, pdf_path, page_num, **kwargs):
    """Test a single extraction method"""
    print(f"Testing {method_name}...")
    
    try:
        start_time = time.time()
        tables = extract_func(pdf_path, page_num, **kwargs)
        duration = time.time() - start_time
        
        print(f"  Duration: {duration:.2f}s")
        print_table_info(tables, method_name)
        
        return {
            "success": True,
            "tables": tables,
            "duration": duration,
            "table_count": len(tables) if tables else 0
        }
        
    except Exception as e:
        print(f"  ❌ Error: {e}")
        return {
            "success": False,
            "error": str(e),
            "duration": 0,
            "table_count": 0
        }

def main():
    print_header("olmOCR Integration Test Suite")
    
    print(f"PDF: {PDF_PATH}")
    print(f"Test Page: {TEST_PAGE}")
    
    # Check if PDF exists
    if not os.path.exists(PDF_PATH):
        print(f"\n❌ ERROR: PDF not found at {PDF_PATH}")
        print("Please ensure the test PDF is in the correct location.")
        sys.exit(1)
    
    # Check for olmOCR API key
    olmocr_api_key = os.getenv("OLMOCR_API_KEY")
    has_olmocr_key = bool(olmocr_api_key)
    
    print(f"olmOCR API Key: {'✅ Found' if has_olmocr_key else '❌ Not set'}")
    
    if not has_olmocr_key:
        print("\n⚠️  olmOCR will be skipped (no API key)")
        print("To test olmOCR, set OLMOCR_API_KEY environment variable:")
        print("  export OLMOCR_API_KEY=your_deepinfra_api_key")
        print("  Get your key at: https://deepinfra.com\n")
    
    # Store results for comparison
    results = {}
    
    # Test 1: PyMuPDF
    print_header("Test 1: PyMuPDF")
    results["pymupdf"] = test_method("PyMuPDF", extract_tables_pymupdf, PDF_PATH, TEST_PAGE)
    
    # Test 2: Camelot
    print_header("Test 2: Camelot")
    results["camelot"] = test_method("Camelot", extract_tables_camelot, PDF_PATH, TEST_PAGE)
    
    # Test 3: Tabula
    print_header("Test 3: Tabula")
    results["tabula"] = test_method("Tabula", extract_tables_tabula, PDF_PATH, TEST_PAGE)
    
    # Test 4: olmOCR (if API key available)
    if has_olmocr_key:
        print_header("Test 4: olmOCR (Allen AI VLM)")
        results["olmocr"] = test_method(
            "olmOCR", 
            extract_tables_olmocr, 
            PDF_PATH, 
            TEST_PAGE,
            api_key=olmocr_api_key
        )
    else:
        print_header("Test 4: olmOCR (Allen AI VLM)")
        print("  ⚠️  Skipped (no API key)")
        results["olmocr"] = {
            "success": False,
            "error": "No API key provided",
            "duration": 0,
            "table_count": 0,
            "skipped": True
        }
    
    # Test 5: Unified API (automatic fallback)
    print_header("Test 5: Unified API (Automatic Fallback)")
    print("Testing unified extraction with automatic method selection...")
    
    try:
        start_time = time.time()
        unified_result = UnifiedExtractor.extract_tables(
            PDF_PATH, 
            TEST_PAGE,
            olmocr_api_key=olmocr_api_key,
            enable_olmocr=has_olmocr_key
        )
        duration = time.time() - start_time
        
        print(f"  Duration: {duration:.2f}s")
        print(f"  Success: {'✅' if unified_result['success'] else '❌'}")
        print(f"  Method used: {unified_result.get('method_used', 'None')}")
        print(f"  Methods tried: {', '.join(unified_result.get('methods_tried', []))}")
        
        if unified_result['success']:
            print_table_info(unified_result['tables'], unified_result['method_used'])
        else:
            print(f"  Errors: {unified_result.get('errors', [])}")
        
        results["unified"] = {
            "success": unified_result['success'],
            "method_used": unified_result.get('method_used'),
            "methods_tried": unified_result.get('methods_tried', []),
            "duration": duration,
            "table_count": unified_result.get('table_count', 0)
        }
        
    except Exception as e:
        print(f"  ❌ Error: {e}")
        results["unified"] = {
            "success": False,
            "error": str(e),
            "duration": 0
        }
    
    # Summary
    print_header("Summary")
    
    print("Method Comparison:")
    print(f"{'Method':<15} {'Status':<10} {'Tables':<10} {'Duration':<12} {'Notes'}")
    print("-" * 80)
    
    for method, result in results.items():
        if method == "unified":
            continue
        
        status = "✅ Success" if result['success'] else "❌ Failed"
        if result.get('skipped'):
            status = "⚠️  Skipped"
        
        tables = result.get('table_count', 0)
        duration = f"{result.get('duration', 0):.2f}s"
        
        notes = ""
        if result.get('skipped'):
            notes = "(No API key)"
        elif not result['success']:
            notes = f"({result.get('error', 'Unknown error')[:30]}...)"
        
        print(f"{method:<15} {status:<10} {tables:<10} {duration:<12} {notes}")
    
    # Unified result
    if "unified" in results:
        unified = results["unified"]
        status = "✅ Success" if unified['success'] else "❌ Failed"
        tables = unified.get('table_count', 0)
        duration = f"{unified.get('duration', 0):.2f}s"
        method_used = unified.get('method_used', 'None')
        
        print("-" * 80)
        print(f"{'Unified API':<15} {status:<10} {tables:<10} {duration:<12} (Used: {method_used})")
    
    # Recommendations
    print("\n" + "="*80)
    print("  Recommendations")
    print("="*80 + "\n")
    
    successful_methods = [m for m, r in results.items() if r['success'] and m != "unified"]
    
    if successful_methods:
        print(f"✅ {len(successful_methods)} method(s) successfully extracted tables")
        
        # Find fastest method
        fastest = min(
            [(m, r['duration']) for m, r in results.items() if r['success'] and m != "unified"],
            key=lambda x: x[1]
        )
        print(f"⚡ Fastest: {fastest[0]} ({fastest[1]:.2f}s)")
        
        # Find most tables
        most_tables = max(
            [(m, r['table_count']) for m, r in results.items() if r['success'] and m != "unified"],
            key=lambda x: x[1]
        )
        print(f"📊 Most tables: {most_tables[0]} ({most_tables[1]} tables)")
        
    else:
        print("❌ No methods successfully extracted tables")
        print("This might indicate an issue with the PDF or extraction methods")
    
    if not has_olmocr_key:
        print("\n💡 To test olmOCR:")
        print("  1. Sign up at https://deepinfra.com")
        print("  2. Get your API key")
        print("  3. Set environment variable: export OLMOCR_API_KEY=your_key")
        print("  4. Run this script again")
    
    # Save results to JSON
    output_file = "olmocr_integration_test_results.json"
    with open(output_file, 'w') as f:
        # Convert results to JSON-serializable format
        json_results = {}
        for method, result in results.items():
            json_results[method] = {
                k: v for k, v in result.items() 
                if k != 'tables'  # Exclude full table data
            }
        json.dump(json_results, f, indent=2)
    
    print(f"\n📄 Results saved to: {output_file}")
    
    print("\n" + "="*80)
    print("  Test Complete!")
    print("="*80 + "\n")

if __name__ == "__main__":
    main()
