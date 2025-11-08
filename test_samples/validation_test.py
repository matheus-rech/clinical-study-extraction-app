#!/usr/bin/env python3
"""
Automated Validation Testing Script
Clinical Study Extraction Application

This script tests all enhanced features including:
- Enhanced text extraction
- PICO-T AI extraction
- Baseline data AI extraction
- Vision-based table extraction
- Vision-based figure extraction
- AI provider comparison
"""

import requests
import json
import time
from pathlib import Path
from typing import Dict, List, Any
import sys

# Configuration
BASE_URL = "http://localhost:8000"
TEST_PDF = Path(__file__).parent / "Won2024.pdf"
RESULTS_FILE = Path(__file__).parent / "validation_results.json"

# ANSI color codes for output
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
RESET = "\033[0m"


class ValidationTest:
    def __init__(self):
        self.results = {
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "test_pdf": str(TEST_PDF),
            "tests": [],
            "summary": {
                "total": 0,
                "passed": 0,
                "failed": 0,
                "warnings": 0
            }
        }
    
    def log(self, message: str, level: str = "INFO"):
        """Log a message with color coding"""
        colors = {
            "INFO": BLUE,
            "PASS": GREEN,
            "FAIL": RED,
            "WARN": YELLOW
        }
        color = colors.get(level, RESET)
        print(f"{color}[{level}]{RESET} {message}")
    
    def record_test(self, name: str, passed: bool, details: Dict[str, Any], duration: float):
        """Record a test result"""
        self.results["tests"].append({
            "name": name,
            "passed": passed,
            "duration_seconds": duration,
            "details": details
        })
        self.results["summary"]["total"] += 1
        if passed:
            self.results["summary"]["passed"] += 1
            self.log(f"✓ {name} ({duration:.2f}s)", "PASS")
        else:
            self.results["summary"]["failed"] += 1
            self.log(f"✗ {name} ({duration:.2f}s)", "FAIL")
    
    def test_server_health(self) -> bool:
        """Test 1: Server Health Check"""
        self.log("Testing server health...", "INFO")
        start = time.time()
        
        try:
            response = requests.get(f"{BASE_URL}/", timeout=10)
            passed = response.status_code == 200
            details = {
                "status_code": response.status_code,
                "response_time_ms": (time.time() - start) * 1000
            }
            self.record_test("Server Health Check", passed, details, time.time() - start)
            return passed
        except Exception as e:
            self.record_test("Server Health Check", False, {"error": str(e)}, time.time() - start)
            return False
    
    def test_enhanced_text_extraction(self) -> bool:
        """Test 2: Enhanced Text Extraction"""
        self.log("Testing enhanced text extraction...", "INFO")
        start = time.time()
        
        try:
            with open(TEST_PDF, 'rb') as f:
                response = requests.post(
                    f"{BASE_URL}/api/extract-text-enhanced",
                    files={"file": f},
                    timeout=30
                )
            
            data = response.json()
            text = data.get("text", "")
            pages = data.get("pages", 0)
            chars = len(text)
            
            passed = (
                response.status_code == 200 and
                pages >= 10 and
                chars > 50000 and
                "cerebellar" in text.lower() and
                "infarct" in text.lower()
            )
            
            details = {
                "status_code": response.status_code,
                "pages": pages,
                "characters": chars,
                "contains_key_terms": "cerebellar" in text.lower() and "infarct" in text.lower()
            }
            
            self.record_test("Enhanced Text Extraction", passed, details, time.time() - start)
            return passed
        except Exception as e:
            self.record_test("Enhanced Text Extraction", False, {"error": str(e)}, time.time() - start)
            return False
    
    def test_vision_table_extraction(self, provider: str = "gemini") -> bool:
        """Test 3: Vision-Based Table Extraction"""
        self.log(f"Testing vision table extraction ({provider})...", "INFO")
        start = time.time()
        
        try:
            with open(TEST_PDF, 'rb') as f:
                response = requests.post(
                    f"{BASE_URL}/api/extract-tables-vision",
                    files={"file": f},
                    data={"pages": "4,5", "provider": provider},
                    timeout=60
                )
            
            data = response.json()
            tables = data.get("tables", [])
            table_count = len(tables)
            
            passed = (
                response.status_code == 200 and
                table_count > 0
            )
            
            details = {
                "status_code": response.status_code,
                "provider": provider,
                "tables_found": table_count,
                "pages_processed": data.get("pages_processed", 0)
            }
            
            if tables:
                details["sample_table_length"] = len(tables[0].get("content", ""))
            
            self.record_test(f"Vision Table Extraction ({provider})", passed, details, time.time() - start)
            return passed
        except Exception as e:
            self.record_test(f"Vision Table Extraction ({provider})", False, {"error": str(e)}, time.time() - start)
            return False
    
    def test_figure_extraction(self, provider: str = "gemini") -> bool:
        """Test 4: Figure Extraction with AI Description"""
        self.log(f"Testing figure extraction ({provider})...", "INFO")
        start = time.time()
        
        try:
            with open(TEST_PDF, 'rb') as f:
                response = requests.post(
                    f"{BASE_URL}/api/extract-figures-complete",
                    files={"file": f},
                    data={"pages": "4,5,6", "provider": provider},
                    timeout=90
                )
            
            data = response.json()
            figures = data.get("figures", [])
            figure_count = len(figures)
            
            passed = (
                response.status_code == 200 and
                figure_count > 0
            )
            
            details = {
                "status_code": response.status_code,
                "provider": provider,
                "figures_found": figure_count,
                "pages_processed": data.get("pages_processed", 0)
            }
            
            if figures:
                details["figure_types"] = [fig.get("type", "unknown") for fig in figures[:3]]
            
            self.record_test(f"Figure Extraction ({provider})", passed, details, time.time() - start)
            return passed
        except Exception as e:
            self.record_test(f"Figure Extraction ({provider})", False, {"error": str(e)}, time.time() - start)
            return False
    
    def test_api_docs_accessible(self) -> bool:
        """Test 5: API Documentation Accessible"""
        self.log("Testing API documentation...", "INFO")
        start = time.time()
        
        try:
            response = requests.get(f"{BASE_URL}/docs", timeout=10)
            passed = response.status_code == 200
            
            details = {
                "status_code": response.status_code,
                "accessible": passed
            }
            
            self.record_test("API Documentation Accessible", passed, details, time.time() - start)
            return passed
        except Exception as e:
            self.record_test("API Documentation Accessible", False, {"error": str(e)}, time.time() - start)
            return False
    
    def test_performance_benchmarks(self) -> bool:
        """Test 6: Performance Benchmarks"""
        self.log("Testing performance benchmarks...", "INFO")
        start = time.time()
        
        try:
            # Test text extraction speed
            text_start = time.time()
            with open(TEST_PDF, 'rb') as f:
                requests.post(
                    f"{BASE_URL}/api/extract-text-enhanced",
                    files={"file": f},
                    timeout=30
                )
            text_duration = time.time() - text_start
            
            passed = text_duration < 15  # Should be under 15 seconds
            
            details = {
                "text_extraction_seconds": text_duration,
                "meets_benchmark": passed,
                "benchmark_target": "< 15 seconds"
            }
            
            self.record_test("Performance Benchmarks", passed, details, time.time() - start)
            return passed
        except Exception as e:
            self.record_test("Performance Benchmarks", False, {"error": str(e)}, time.time() - start)
            return False
    
    def run_all_tests(self):
        """Run all validation tests"""
        self.log("=" * 60, "INFO")
        self.log("Clinical Study Extraction - Validation Test Suite", "INFO")
        self.log("=" * 60, "INFO")
        self.log(f"Test PDF: {TEST_PDF}", "INFO")
        self.log(f"Base URL: {BASE_URL}", "INFO")
        self.log("=" * 60, "INFO")
        
        # Check if PDF exists
        if not TEST_PDF.exists():
            self.log(f"Test PDF not found: {TEST_PDF}", "FAIL")
            return False
        
        # Run tests
        tests = [
            self.test_server_health,
            self.test_api_docs_accessible,
            self.test_enhanced_text_extraction,
            lambda: self.test_vision_table_extraction("gemini"),
            lambda: self.test_vision_table_extraction("claude"),
            lambda: self.test_figure_extraction("gemini"),
            lambda: self.test_figure_extraction("claude"),
            self.test_performance_benchmarks,
        ]
        
        for test in tests:
            try:
                test()
            except Exception as e:
                self.log(f"Test failed with exception: {e}", "FAIL")
            time.sleep(1)  # Brief pause between tests
        
        # Print summary
        self.log("=" * 60, "INFO")
        self.log("Test Summary", "INFO")
        self.log("=" * 60, "INFO")
        self.log(f"Total Tests: {self.results['summary']['total']}", "INFO")
        self.log(f"Passed: {self.results['summary']['passed']}", "PASS")
        self.log(f"Failed: {self.results['summary']['failed']}", "FAIL" if self.results['summary']['failed'] > 0 else "INFO")
        
        pass_rate = (self.results['summary']['passed'] / self.results['summary']['total'] * 100) if self.results['summary']['total'] > 0 else 0
        self.log(f"Pass Rate: {pass_rate:.1f}%", "PASS" if pass_rate >= 80 else "WARN")
        
        # Save results
        with open(RESULTS_FILE, 'w') as f:
            json.dump(self.results, f, indent=2)
        self.log(f"Results saved to: {RESULTS_FILE}", "INFO")
        
        return self.results['summary']['failed'] == 0


def main():
    """Main entry point"""
    validator = ValidationTest()
    success = validator.run_all_tests()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
