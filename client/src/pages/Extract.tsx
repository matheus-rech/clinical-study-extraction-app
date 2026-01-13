import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useLocation } from 'wouter';
import { FileText, Download, ArrowLeft, Loader2, Bot, Sparkles, FileSpreadsheet, LayoutGrid, List } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { PdfViewer, locateTextInPdf, HighlightLocation } from '@/components/PdfViewer';
import { ExtractionSidebar } from '@/components/ExtractionSidebar';
import { ClinicalExtractionForm } from '@/components/ClinicalExtractionForm';
import { AgentComparisonView } from '@/components/AgentComparisonView';
import { SchemaEditor } from '@/components/SchemaEditor';
import { ExportModal } from '@/components/ExportModal';
import { ExportDataModal } from '@/components/ExportDataModal';
import { SummaryModal } from '@/components/SummaryModal';
import { 
  DEFAULT_EXTRACTION_SCHEMA, CLINICAL_MASTER_SCHEMA,
  type ExtractionSchema, type ExtractedData, type ExtractedFieldData, 
  type LocationData, type ClinicalStudyExtraction, type AIProvider 
} from '../../../drizzle/schema';

declare global {
  interface Window {
    pdfjsLib: any;
  }
}

type ViewMode = 'simple' | 'clinical' | 'comparison';

interface AgentExtractionResult {
  provider: AIProvider;
  extractedData: ExtractedData | null;
  status: 'pending' | 'extracting' | 'completed' | 'failed';
  error?: string;
}

export default function Extract() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const documentId = params.id ? parseInt(params.id) : null;

  // State
  const [schema, setSchema] = useState<ExtractionSchema>(CLINICAL_MASTER_SCHEMA);
  const [extractedData, setExtractedData] = useState<ExtractedData | ClinicalStudyExtraction | null>(null);
  const [documentText, setDocumentText] = useState<string>('');
  const [highlightLocation, setHighlightLocation] = useState<HighlightLocation | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [extractionId, setExtractionId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('clinical');

  // Multi-agent extraction state
  const [agentExtractions, setAgentExtractions] = useState<AgentExtractionResult[]>([]);
  const [isMultiAgentExtracting, setIsMultiAgentExtracting] = useState(false);

  // Modals
  const [showSchemaEditor, setShowSchemaEditor] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showDataExport, setShowDataExport] = useState(false);
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
  const multiAgentExtractMutation = trpc.ai.multiAgentExtract.useMutation();
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

  // Single Agent AI Auto-Extract
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
        const groundedData = await groundExtractedData(result.extractedData as ExtractedData);
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

  // Multi-Agent Extraction (3 providers)
  const handleMultiAgentExtract = async () => {
    if (!documentText) {
      toast.error('Please wait for the PDF to load');
      return;
    }

    setIsMultiAgentExtracting(true);
    setViewMode('comparison');
    
    // Initialize agent states
    const providers: AIProvider[] = ['gemini', 'claude', 'openrouter'];
    setAgentExtractions(providers.map(p => ({
      provider: p,
      extractedData: null,
      status: 'pending',
    })));

    try {
      const extId = await ensureExtraction();

      // Update status to extracting
      setAgentExtractions(prev => prev.map(ae => ({ ...ae, status: 'extracting' as const })));

      const result = await multiAgentExtractMutation.mutateAsync({
        extractionId: extId,
        documentText,
        providers,
      });

      // Update with results
      setAgentExtractions(result.results.map(r => ({
        provider: r.provider as AIProvider,
        extractedData: r.extractedData as ExtractedData | null,
        status: r.status as 'pending' | 'extracting' | 'completed' | 'failed',
        error: r.error || undefined,
      })));

      // Set consensus as main extracted data
      if (result.consensus) {
        const groundedData = await groundExtractedData(result.consensus as ExtractedData);
        setExtractedData(groundedData);
        
        await updateExtractionMutation.mutateAsync({
          id: extId,
          extractedData: groundedData,
        });
      }

      const successCount = result.results.filter(r => r.status === 'completed').length;
      toast.success(`Multi-agent extraction completed (${successCount}/${providers.length} agents)`);
    } catch (error) {
      console.error('Multi-agent extraction failed:', error);
      toast.error('Multi-agent extraction failed. Please try again.');
      setAgentExtractions(prev => prev.map(ae => ({ ...ae, status: 'failed' as const })));
    } finally {
      setIsMultiAgentExtracting(false);
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
      // Get the text to search for - use exact_text_reference from source_location if available
      const searchText = fieldData.source_location?.exact_text_reference || String(fieldData.value);
      
      // Try to find location in PDF
      let location = null;
      if (searchText) {
        location = await locateTextInPdf(pdf, searchText);
      }

      // Build the grounded field data
      const groundedField: ExtractedFieldData = {
        value: fieldData.value,
        confidence: fieldData.confidence,
        source_location: fieldData.source_location,
        notes: fieldData.notes,
      };

      // Add PDF location data if found
      if (location) {
        groundedField.location = {
          page: location.page,
          exact: searchText,
          rects: [location.rect],
          selector: {
            type: 'FragmentSelector',
            conformsTo: 'http://tools.ietf.org/rfc/rfc3778',
            value: `page=${location.page}&rect=${location.rect.join(',')}`,
          },
        };
      }

      groundedData[key] = groundedField;
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

  // View source by page and text (for clinical form)
  const handleViewSourceByPage = (page: number, exactText: string) => {
    // Try to find the text in the PDF and highlight it
    if (window.pdfjsLib && document?.s3Url) {
      const loadingTask = window.pdfjsLib.getDocument(document.s3Url);
      loadingTask.promise.then(async (pdf: any) => {
        const location = await locateTextInPdf(pdf, exactText);
        if (location) {
          setHighlightLocation({
            page: location.page,
            rects: [location.rect],
          });
        } else {
          // Just go to the page
          setHighlightLocation({
            page,
            rects: [],
          });
        }
      });
    } else {
      setHighlightLocation({
        page,
        rects: [],
      });
    }
  };

  // Update field value (simple mode)
  const handleUpdateField = async (fieldName: string, value: string) => {
    const newData: ExtractedData = {
      ...(extractedData as ExtractedData),
      [fieldName]: {
        ...(extractedData as ExtractedData)?.[fieldName],
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

  // Update clinical data (clinical mode)
  const handleUpdateClinicalData = async (path: string, value: any) => {
    // Deep update the data at the given path
    const newData = { ...(extractedData as ClinicalStudyExtraction) };
    const parts = path.split('.');
    let current: any = newData;
    
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part]) {
        current[part] = {};
      }
      current = current[part];
    }
    
    current[parts[parts.length - 1]] = value;
    setExtractedData(newData);

    // Auto-save
    if (extractionId) {
      try {
        await updateExtractionMutation.mutateAsync({
          id: extractionId,
          extractedData: newData as any,
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
    
    // Switch view mode based on schema
    if (newSchema.useClinicalMasterSchema) {
      setViewMode('clinical');
    } else {
      setViewMode('simple');
    }
  };

  // Select consensus from comparison
  const handleSelectConsensus = (data: ExtractedData) => {
    setExtractedData(data);
    toast.success('Consensus value selected');
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
            <p className="text-xs text-slate-500">Clinical Data Extraction</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 rounded-lg p-1">
            <Button
              variant={viewMode === 'simple' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 px-2"
              onClick={() => setViewMode('simple')}
            >
              <List className="h-3.5 w-3.5 mr-1" />
              Simple
            </Button>
            <Button
              variant={viewMode === 'clinical' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 px-2"
              onClick={() => setViewMode('clinical')}
            >
              <LayoutGrid className="h-3.5 w-3.5 mr-1" />
              Clinical
            </Button>
            <Button
              variant={viewMode === 'comparison' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 px-2"
              onClick={() => setViewMode('comparison')}
            >
              <Bot className="h-3.5 w-3.5 mr-1" />
              Compare
            </Button>
          </div>

          {/* Multi-Agent Extract Button */}
          <Button 
            variant="outline" 
            onClick={handleMultiAgentExtract}
            disabled={!documentText || isMultiAgentExtracting}
          >
            {isMultiAgentExtracting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            3-Agent Extract
          </Button>

          {/* Export Buttons */}
          <Button variant="outline" onClick={() => setShowDataExport(true)}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            CSV
          </Button>
          <Button variant="outline" onClick={() => setShowExport(true)}>
            <Download className="h-4 w-4 mr-2" />
            JSON
          </Button>
        </div>
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

        {/* Right Sidebar - Different views */}
        <div className="w-[420px] border-l bg-white flex flex-col overflow-hidden">
          {viewMode === 'simple' && (
            <ExtractionSidebar
              schema={schema}
              extractedData={extractedData as ExtractedData}
              isExtracting={isExtracting}
              isSummarizing={isSummarizing}
              onExtract={handleExtract}
              onSummarize={handleSummarize}
              onViewSource={handleViewSource}
              onUpdateField={handleUpdateField}
              onEditSchema={() => setShowSchemaEditor(true)}
              disabled={!documentText}
            />
          )}
          
          {viewMode === 'clinical' && (
            <ClinicalExtractionForm
              data={extractedData as ClinicalStudyExtraction}
              onUpdate={handleUpdateClinicalData}
              onViewSource={handleViewSourceByPage}
              isReadOnly={false}
            />
          )}
          
          {viewMode === 'comparison' && (
            <AgentComparisonView
              agentExtractions={agentExtractions}
              consensusData={extractedData as ExtractedData}
              onSelectConsensus={handleSelectConsensus}
              onViewSource={handleViewSourceByPage}
              isLoading={isMultiAgentExtracting}
            />
          )}
        </div>
      </div>

      {/* Modals */}
      <SchemaEditor
        open={showSchemaEditor}
        onOpenChange={setShowSchemaEditor}
        schema={schema}
        onSave={handleSaveSchema}
        documentContext={documentText}
      />

      <ExportModal
        open={showExport}
        onOpenChange={setShowExport}
        extractedData={extractedData as ExtractedData}
        schema={schema}
        documentName={document?.filename}
      />

      <ExportDataModal
        isOpen={showDataExport}
        onClose={() => setShowDataExport(false)}
        extractedData={extractedData}
        agentExtractions={agentExtractions.filter(ae => ae.status === 'completed').map(ae => ({
          provider: ae.provider,
          extractedData: ae.extractedData,
        }))}
        documentName={document?.filename || 'document'}
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
