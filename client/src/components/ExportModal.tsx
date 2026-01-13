import { Download, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import type { ExtractedData, ExtractionSchema, Confidence, SourceLocation } from '../../../drizzle/schema';

interface ExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  extractedData: ExtractedData | null;
  schema: ExtractionSchema;
  documentName?: string;
}

interface W3CAnnotation {
  "@context": string;
  id: string;
  type: string;
  body: {
    type: string;
    value: string | number | boolean;
    confidence: Confidence;
    notes?: string;
  };
  target: {
    source: string;
    selector?: {
      type: string;
      conformsTo?: string;
      value: string;
      page?: number;
      section?: string;
      specific_location?: string;
      exact_text_reference?: string;
    };
  };
}

interface ExportFormat {
  "@context": string;
  type: string;
  generator: string;
  generated: string;
  document: string;
  annotations: W3CAnnotation[];
}

export function ExportModal({ open, onOpenChange, extractedData, schema, documentName }: ExportModalProps) {
  const [copied, setCopied] = useState(false);

  const generateW3CExport = (): ExportFormat => {
    const annotations: W3CAnnotation[] = [];

    if (extractedData) {
      schema.fields.forEach((field) => {
        const data = extractedData[field.name];
        if (!data) return;

        const annotation: W3CAnnotation = {
          "@context": "http://www.w3.org/ns/anno.jsonld",
          id: `#${field.name}`,
          type: "Annotation",
          body: {
            type: "TextualBody",
            value: data.value,
            confidence: data.confidence || 'low',
            ...(data.notes && { notes: data.notes }),
          },
          target: {
            source: documentName || 'document.pdf',
          },
        };

        // Add source location selector if available
        if (data.source_location) {
          annotation.target.selector = {
            type: "FragmentSelector",
            conformsTo: "http://tools.ietf.org/rfc/rfc3778",
            value: `page=${data.source_location.page}`,
            page: data.source_location.page,
            ...(data.source_location.section && { section: data.source_location.section }),
            ...(data.source_location.specific_location && { specific_location: data.source_location.specific_location }),
            ...(data.source_location.exact_text_reference && { exact_text_reference: data.source_location.exact_text_reference }),
          };
        } else if (data.location) {
          // Legacy location format
          annotation.target.selector = {
            type: data.location.selector.type,
            conformsTo: data.location.selector.conformsTo,
            value: data.location.selector.value,
            page: data.location.page,
            exact_text_reference: data.location.exact,
          };
        }

        annotations.push(annotation);
      });
    }

    return {
      "@context": "http://www.w3.org/ns/anno.jsonld",
      type: "AnnotationCollection",
      generator: "PDF Data Extractor",
      generated: new Date().toISOString(),
      document: documentName || 'document.pdf',
      annotations,
    };
  };

  const exportData = generateW3CExport();
  const jsonString = JSON.stringify(exportData, null, 2);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${documentName?.replace('.pdf', '') || 'extractions'}_annotations.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Export Annotations</DialogTitle>
          <DialogDescription>
            W3C Web Annotation format with full provenance tracking (confidence levels, source locations, exact text references)
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden rounded-lg border bg-slate-900">
          <pre className="p-4 overflow-auto h-full max-h-[400px] text-emerald-400 text-sm font-mono">
            {jsonString}
          </pre>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={handleCopy}>
            {copied ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-2" />
                Copy to Clipboard
              </>
            )}
          </Button>
          <Button onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            Download JSON
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
