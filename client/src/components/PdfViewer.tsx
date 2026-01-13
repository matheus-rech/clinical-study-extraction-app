import { useRef, useEffect, useCallback, useState } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// PDF.js configuration - Using CDN
const PDF_JS_VERSION = '3.11.174';
const PDF_JS_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDF_JS_VERSION}/pdf.min.js`;
const PDF_JS_WORKER_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDF_JS_VERSION}/pdf.worker.min.js`;
const PDF_JS_CSS_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDF_JS_VERSION}/pdf_viewer.min.css`;

declare global {
  interface Window {
    pdfjsLib: any;
  }
}

export interface HighlightLocation {
  page: number;
  rects: number[][];
}

interface PdfViewerProps {
  pdfUrl: string | null;
  onTextExtracted?: (text: string) => void;
  highlightLocation?: HighlightLocation | null;
  className?: string;
}

export function PdfViewer({ pdfUrl, onTextExtracted, highlightLocation, className }: PdfViewerProps) {
  const [pdf, setPdf] = useState<any>(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [isLoading, setIsLoading] = useState(false);
  const [pdfJsLoaded, setPdfJsLoaded] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const highlightLayerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load PDF.js resources
  useEffect(() => {
    const loadPdfJs = () => {
      // Load CSS
      if (!document.querySelector(`link[href="${PDF_JS_CSS_URL}"]`)) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = PDF_JS_CSS_URL;
        document.head.appendChild(link);
      }

      // Check if already loaded
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_JS_WORKER_URL;
        setPdfJsLoaded(true);
        return;
      }

      // Load JS
      const existingScript = document.querySelector(`script[src="${PDF_JS_URL}"]`);
      if (existingScript) {
        existingScript.addEventListener('load', () => {
          if (window.pdfjsLib) {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_JS_WORKER_URL;
            setPdfJsLoaded(true);
          }
        });
        return;
      }

      const script = document.createElement('script');
      script.src = PDF_JS_URL;
      script.async = true;
      script.onload = () => {
        if (window.pdfjsLib) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_JS_WORKER_URL;
          setPdfJsLoaded(true);
        }
      };
      document.head.appendChild(script);
    };

    loadPdfJs();
  }, []);

  // Load PDF when URL changes
  useEffect(() => {
    if (!pdfUrl || !pdfJsLoaded || !window.pdfjsLib) return;

    const loadPdf = async () => {
      setIsLoading(true);
      try {
        const loadingTask = window.pdfjsLib.getDocument(pdfUrl);
        const pdfDoc = await loadingTask.promise;
        setPdf(pdfDoc);
        setNumPages(pdfDoc.numPages);
        setPageNum(1);

        // Extract all text for AI processing
        if (onTextExtracted) {
          let fullText = '';
          const limit = Math.min(pdfDoc.numPages, 30);
          for (let i = 1; i <= limit; i++) {
            const page = await pdfDoc.getPage(i);
            const content = await page.getTextContent();
            const strings = content.items.map((item: any) => item.str);
            fullText += `--- Page ${i} ---\n` + strings.join(' ') + '\n';
          }
          onTextExtracted(fullText);
        }
      } catch (error) {
        console.error('Error loading PDF:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPdf();
  }, [pdfUrl, pdfJsLoaded, onTextExtracted]);

  // Render page
  const renderPage = useCallback(async (num: number) => {
    if (!pdf || !canvasRef.current || !textLayerRef.current) return;

    try {
      const page = await pdf.getPage(num);
      const viewport = page.getViewport({ scale });

      // Canvas
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;
      
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({ canvasContext: context, viewport }).promise;

      // Text Layer
      const textContent = await page.getTextContent();
      textLayerRef.current.innerHTML = '';
      textLayerRef.current.style.width = `${viewport.width}px`;
      textLayerRef.current.style.height = `${viewport.height}px`;
      textLayerRef.current.className = 'textLayer absolute inset-0 opacity-20 mix-blend-multiply pointer-events-auto cursor-text';
      textLayerRef.current.style.setProperty('--scale-factor', String(scale));

      window.pdfjsLib.renderTextLayer({
        textContentSource: textContent,
        container: textLayerRef.current,
        viewport: viewport,
        textDivs: [],
      });

      // Clear highlights
      if (highlightLayerRef.current) {
        highlightLayerRef.current.innerHTML = '';
      }
    } catch (error) {
      console.error('Error rendering page:', error);
    }
  }, [pdf, scale]);

  useEffect(() => {
    if (pdf) renderPage(pageNum);
  }, [pdf, pageNum, scale, renderPage]);

  // Draw highlight when location changes
  useEffect(() => {
    if (!highlightLocation || !pdf || highlightLocation.page !== pageNum) return;

    const drawHighlight = async () => {
      const page = await pdf.getPage(highlightLocation.page);
      const viewport = page.getViewport({ scale });
      const highlightLayer = highlightLayerRef.current;

      if (!highlightLayer) return;
      highlightLayer.innerHTML = '';

      highlightLocation.rects.forEach((rect: number[]) => {
        const [x1, y1, x2, y2] = viewport.convertToViewportRectangle(rect);

        const div = document.createElement('div');
        div.className = 'absolute bg-yellow-400/40 border border-yellow-600/50 rounded-sm pointer-events-none animate-pulse';
        div.style.left = `${Math.min(x1, x2)}px`;
        div.style.top = `${Math.min(y1, y2)}px`;
        div.style.width = `${Math.abs(x2 - x1)}px`;
        div.style.height = `${Math.abs(y2 - y1)}px`;

        highlightLayer.appendChild(div);

        // Fade out after 4 seconds
        setTimeout(() => {
          div.style.transition = 'opacity 1s';
          div.style.opacity = '0';
          setTimeout(() => div.remove(), 1000);
        }, 4000);
      });
    };

    drawHighlight();
  }, [highlightLocation, pdf, pageNum, scale]);

  // Navigate to highlight page
  useEffect(() => {
    if (highlightLocation && highlightLocation.page !== pageNum) {
      setPageNum(highlightLocation.page);
    }
  }, [highlightLocation]);

  const handleZoomIn = () => setScale(s => Math.min(s + 0.2, 3));
  const handleZoomOut = () => setScale(s => Math.max(s - 0.2, 0.5));
  const handlePrevPage = () => setPageNum(p => Math.max(1, p - 1));
  const handleNextPage = () => setPageNum(p => Math.min(numPages, p + 1));

  return (
    <div className={cn('flex flex-col h-full bg-slate-100', className)}>
      {/* Controls */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b shrink-0">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handlePrevPage} disabled={pageNum <= 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[100px] text-center">
            Page {pageNum} of {numPages || '?'}
          </span>
          <Button variant="outline" size="icon" onClick={handleNextPage} disabled={pageNum >= numPages}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handleZoomOut} disabled={scale <= 0.5}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[60px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <Button variant="outline" size="icon" onClick={handleZoomIn} disabled={scale >= 3}>
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* PDF Display */}
      <div ref={containerRef} className="flex-1 overflow-auto p-4 flex justify-center">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : pdf ? (
          <div className="relative shadow-lg bg-white">
            <canvas ref={canvasRef} className="block" />
            <div ref={textLayerRef} className="textLayer" />
            <div ref={highlightLayerRef} className="absolute inset-0 pointer-events-none" />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-slate-400">
            <p>No PDF loaded</p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Robust text locator algorithm to find AI-extracted quotes in PDF text content
 * Reconstructs page text map to find phrases that span multiple PDF text items
 */
export async function locateTextInPdf(
  pdf: any,
  searchText: string,
  maxPages: number = 30
): Promise<{ page: number; rect: number[] } | null> {
  if (!pdf || !searchText) return null;

  // Normalize spaces and case
  const cleanSearch = searchText.replace(/\s+/g, ' ').trim().toLowerCase();
  const isNumber = /^\d+$/.test(cleanSearch);
  if (cleanSearch.length < 3 && !isNumber) return null;

  const limit = Math.min(pdf.numPages, maxPages);

  for (let i = 1; i <= limit; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    // Build a searchable map of the page
    let fullPageText = '';
    const itemMap: { start: number; end: number; item: any }[] = [];

    for (const item of content.items) {
      const str = item.str;
      if (!str.trim()) continue;

      const startIdx = fullPageText.length;
      fullPageText += str + ' ';
      const endIdx = fullPageText.length;

      itemMap.push({
        start: startIdx,
        end: endIdx - 1,
        item: item,
      });
    }

    // Search in the full string
    const matchIndex = fullPageText.toLowerCase().indexOf(cleanSearch);

    if (matchIndex !== -1) {
      const matchEnd = matchIndex + cleanSearch.length;

      // Find which PDF items correspond to this match
      const involvedItems = itemMap.filter(
        (m) => m.end >= matchIndex && m.start < matchEnd
      );

      if (involvedItems.length > 0) {
        // Calculate bounding box
        let minX = Infinity,
          minY = Infinity,
          maxX = -Infinity,
          maxY = -Infinity;

        involvedItems.forEach(({ item }) => {
          const x = item.transform[4];
          const y = item.transform[5];
          const w = item.width;
          const h = item.height || 10;

          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x + w);
          maxY = Math.max(maxY, y + h);
        });

        const padding = 2;
        return {
          page: i,
          rect: [minX - padding, minY - padding, maxX + padding, maxY + padding],
        };
      }
    }
  }

  return null;
}
