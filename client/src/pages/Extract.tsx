import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useLocation } from 'wouter';
import { FileText, Download, ArrowLeft, Loader2 } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { PdfViewer, locateTextInPdf, HighlightLocation } from '@/components/PdfViewer';
import { ExtractionSidebar } from '@/components/ExtractionSidebar';
import { SchemaEditor } from '@/components/SchemaEditor';
import { ExportModal } from '@/components/ExportModal';
import { SummaryModal } from '@/components/SummaryModal';
import { DEFAULT_EXTRACTION_SCHEMA, type ExtractionSchema, type ExtractedData, type LocationData } from '../../../drizzle/schema';

declare global {
  interface Window {
    pdfjsLib: any;
  }
}

export default function Extract() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const documentId = params.id ? parseInt(params.id) : null;

  // State
  const [schema, setSchema] = useState<ExtractionSchema>(DEFAULT_EXTRACTION_SCHEMA);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [documentText, setDocumentText] = useState<string>('');
  const [highlightLocation, setHighlightLocation] = useState<HighlightLocation | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [extractionId, setExtractionId] = useState<number | null>(null);

  // Modals
  const [showSchemaEditor, setShowSchemaEditor] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  // PDF reference for text location
  const pdfRef = useRef<any>(null);

  // Queries
  const { data: document, isLoading: isLoadingDoc } = trpc.documents.get.useQuery(
    { id: documentId! },
    { enabled: !!documentId }
  );

  const { data: existingExtractions } = trpc.extractions.list.useQuery(
    { documentId: documentId! },
    { enabled: !!documentId }
  );

  // Mutations
  const createExtractionMutation = trpc.extractions.create.useMutation();
  const updateExtractionMutation = trpc.extractions.update.useMutation();
  const extractMutation = trpc.ai.extract.useMutation();
  const summarizeMutation = trpc.ai.summarize.useMutation();

  // Load existing extraction if available
  useEffect(() => {
    if (existingExtractions && existingExtractions.length > 0) {
      const latest = existingExtractions[0];
      setExtractionId(latest.id);
      setSchema(latest.schema as ExtractionSchema);
      if (latest.extractedData) {
        setExtractedData(latest.extractedData as ExtractedData);
      }
      if (latest.summary) {
        setSummary(latest.summary);
      }
    }
  }, [existingExtractions]);

  // Handle text extraction from PDF
  const handleTextExtracted = useCallback((text: string) => {
    setDocumentText(text);
  }, []);

  // Create or get extraction session
  const ensureExtraction = async (): Promise<number> => {
    if (extractionId) return extractionId;

    if (!documentId) throw new Error('No document selected');

    const extraction = await createExtractionMutation.mutateAsync({
      documentId,
      schema,
    });

    setExtractionId(extraction.id);
    return extraction.id;
  };

  // AI Auto-Extract
  const handleExtract = async () => {
    if (!documentText) {
      toast.error('Please wait for the PDF to load');
      return;
    }

    setIsExtracting(true);
    try {
      const extId = await ensureExtraction();

      const result = await extractMutation.mutateAsync({
        extractionId: extId,
        documentText,
      });

      if (result.extractedData) {
        // Ground the extracted data by finding locations in PDF
        const groundedData = await groundExtractedData(result.extractedData);
        setExtractedData(groundedData);

        // Save grounded data
        await updateExtractionMutation.mutateAsync({
          id: extId,
          extractedData: groundedData,
        });

        toast.success('Extraction completed successfully');
      }
    } catch (error) {
      console.error('Extraction failed:', error);
      toast.error('Extraction failed. Please try again.');
    } finally {
      setIsExtracting(false);
    }
  };

  // Ground extracted data by finding text locations in PDF
  const groundExtractedData = async (data: ExtractedData): Promise<ExtractedData> => {
    if (!window.pdfjsLib || !document?.s3Url) return data;

    const groundedData: ExtractedData = {};

    // Load PDF for text location
    const loadingTask = window.pdfjsLib.getDocument(document.s3Url);
    const pdf = await loadingTask.promise;

    for (const [key, fieldData] of Object.entries(data)) {
      // Skip quote fields
      if (key.endsWith('_quote')) continue;

      const quoteKey = `${key}_quote`;
      const quote = data[quoteKey]?.value;
      const value = fieldData.value;

      // Try to find location using quote first, then value
      let location = null;
      if (quote) {
        location = await locateTextInPdf(pdf, quote);
      }
      if (!location && value) {
        location = await locateTextInPdf(pdf, value);
      }

      groundedData[key] = {
        value,
        location: location
          ? {
              page: location.page,
              exact: quote || value,
              rects: [location.rect],
              selector: {
                type: 'FragmentSelector',
                conformsTo: 'http://tools.ietf.org/rfc/rfc3778',
                value: `page=${location.page}&rect=${location.rect.join(',')}`,
              },
            }
          : undefined,
      };

      // Keep quote for export
      if (quote) {
        groundedData[quoteKey] = { value: quote };
      }
    }

    return groundedData;
  };

  // AI Summarize
  const handleSummarize = async () => {
    if (!documentText) {
      toast.error('Please wait for the PDF to load');
      return;
    }

    setIsSummarizing(true);
    setShowSummary(true);
    try {
      const extId = await ensureExtraction();

      const result = await summarizeMutation.mutateAsync({
        extractionId: extId,
        documentText,
      });

      setSummary(result.summary);
    } catch (error) {
      console.error('Summarization failed:', error);
      toast.error('Summarization failed. Please try again.');
    } finally {
      setIsSummarizing(false);
    }
  };

  // View source in PDF
  const handleViewSource = (fieldName: string, location: LocationData) => {
    setHighlightLocation({
      page: location.page,
      rects: location.rects,
    });
  };

  // Update field value
  const handleUpdateField = async (fieldName: string, value: string) => {
    const newData: ExtractedData = {
      ...extractedData,
      [fieldName]: {
        ...extractedData?.[fieldName],
        value,
      },
    };
    setExtractedData(newData);

    // Auto-save if we have an extraction
    if (extractionId) {
      try {
        await updateExtractionMutation.mutateAsync({
          id: extractionId,
          extractedData: newData,
        });
      } catch (error) {
        console.error('Failed to save:', error);
      }
    }
  };

  // Save schema
  const handleSaveSchema = async (newSchema: ExtractionSchema) => {
    setSchema(newSchema);
    // Clear extracted data when schema changes
    setExtractedData(null);
    setExtractionId(null);
  };

  if (!documentId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-slate-500">No document selected</p>
      </div>
    );
  }

  if (isLoadingDoc) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      {/* Header */}
      <header className="h-14 bg-white border-b flex items-center justify-between px-4 shrink-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/library')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="bg-blue-600 p-2 rounded-lg">
            <FileText className="h-4 w-4 text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-sm truncate max-w-[300px]">
              {document?.filename || 'Document'}
            </h1>
            <p className="text-xs text-slate-500">PDF Data Extractor</p>
          </div>
        </div>

        <Button variant="outline" onClick={() => setShowExport(true)}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* PDF Viewer */}
        <PdfViewer
          pdfUrl={document?.s3Url || null}
          onTextExtracted={handleTextExtracted}
          highlightLocation={highlightLocation}
          className="flex-1"
        />

        {/* Extraction Sidebar */}
        <ExtractionSidebar
          schema={schema}
          extractedData={extractedData}
          isExtracting={isExtracting}
          isSummarizing={isSummarizing}
          onExtract={handleExtract}
          onSummarize={handleSummarize}
          onViewSource={handleViewSource}
          onUpdateField={handleUpdateField}
          onEditSchema={() => setShowSchemaEditor(true)}
          disabled={!documentText}
        />
      </div>

      {/* Modals */}
      <SchemaEditor
        open={showSchemaEditor}
        onOpenChange={setShowSchemaEditor}
        schema={schema}
        onSave={handleSaveSchema}
      />

      <ExportModal
        open={showExport}
        onOpenChange={setShowExport}
        extractedData={extractedData}
        schema={schema}
        documentName={document?.filename}
      />

      <SummaryModal
        open={showSummary}
        onOpenChange={setShowSummary}
        summary={summary}
        isLoading={isSummarizing}
      />
    </div>
  );
}
