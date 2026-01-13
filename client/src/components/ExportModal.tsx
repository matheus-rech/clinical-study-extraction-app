import { Download, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import type { ExtractedData, ExtractionSchema } from '../../../drizzle/schema';

interface ExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  extractedData: ExtractedData | null;
  schema: ExtractionSchema;
  documentName?: string;
}

interface W3CAnnotation {
  id: string;
  value: string;
  source_page: number | null;
  source_quote?: string;
}

export function ExportModal({ open, onOpenChange, extractedData, schema, documentName }: ExportModalProps) {
  const [copied, setCopied] = useState(false);

  const generateW3CExport = (): W3CAnnotation[] => {
    if (!extractedData) return [];

    return schema.fields
      .filter((field) => extractedData[field.name])
      .map((field) => {
        const data = extractedData[field.name];
        const quoteData = extractedData[`${field.name}_quote`];
        
        return {
          id: field.name,
          value: data?.value || '',
          source_page: data?.location?.page || null,
          ...(quoteData?.value && { source_quote: quoteData.value }),
        };
      });
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
            W3C-style JSON annotations with field values and source page references
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
