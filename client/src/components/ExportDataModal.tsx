import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Download, FileSpreadsheet, FileText, Table } from 'lucide-react';
import type { ClinicalStudyExtraction, ExtractedData, AIProvider } from '../../../drizzle/schema';

interface ExportDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  extractedData: ExtractedData | ClinicalStudyExtraction | null;
  agentExtractions?: Array<{
    provider: AIProvider;
    extractedData: ExtractedData | null;
  }>;
  documentName: string;
}

type ExportFormat = 'csv' | 'json' | 'tsv';

export function ExportDataModal({
  isOpen,
  onClose,
  extractedData,
  agentExtractions,
  documentName,
}: ExportDataModalProps) {
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [includeConfidence, setIncludeConfidence] = useState(true);
  const [includeSourceLocation, setIncludeSourceLocation] = useState(true);
  const [includeAgentComparison, setIncludeAgentComparison] = useState(false);

  const hasAgentData = agentExtractions && agentExtractions.length > 0;

  const handleExport = () => {
    if (!extractedData) return;

    let content: string;
    let filename: string;
    let mimeType: string;

    if (includeAgentComparison && hasAgentData) {
      content = generateComparisonExport(extractedData, agentExtractions!, format, includeConfidence, includeSourceLocation);
      filename = `${documentName.replace(/\.[^/.]+$/, '')}_comparison.${format}`;
    } else {
      content = generateSingleExport(extractedData, format, includeConfidence, includeSourceLocation);
      filename = `${documentName.replace(/\.[^/.]+$/, '')}_extraction.${format}`;
    }

    mimeType = format === 'json' ? 'application/json' : 'text/csv';

    // Download file
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Extraction Data
          </DialogTitle>
          <DialogDescription>
            Choose format and options for your export
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Format Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Export Format</Label>
            <RadioGroup value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
              <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-slate-50 cursor-pointer">
                <RadioGroupItem value="csv" id="csv" />
                <Label htmlFor="csv" className="flex items-center gap-2 cursor-pointer flex-1">
                  <FileSpreadsheet className="h-4 w-4 text-green-600" />
                  <div>
                    <p className="font-medium">CSV</p>
                    <p className="text-xs text-slate-500">Comma-separated values, Excel compatible</p>
                  </div>
                </Label>
              </div>
              <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-slate-50 cursor-pointer">
                <RadioGroupItem value="tsv" id="tsv" />
                <Label htmlFor="tsv" className="flex items-center gap-2 cursor-pointer flex-1">
                  <Table className="h-4 w-4 text-blue-600" />
                  <div>
                    <p className="font-medium">TSV</p>
                    <p className="text-xs text-slate-500">Tab-separated values</p>
                  </div>
                </Label>
              </div>
              <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-slate-50 cursor-pointer">
                <RadioGroupItem value="json" id="json" />
                <Label htmlFor="json" className="flex items-center gap-2 cursor-pointer flex-1">
                  <FileText className="h-4 w-4 text-orange-600" />
                  <div>
                    <p className="font-medium">JSON</p>
                    <p className="text-xs text-slate-500">Structured data format</p>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Options */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Include in Export</Label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="confidence" 
                  checked={includeConfidence}
                  onCheckedChange={(checked) => setIncludeConfidence(!!checked)}
                />
                <Label htmlFor="confidence" className="text-sm cursor-pointer">
                  Confidence levels (high/medium/low)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="source" 
                  checked={includeSourceLocation}
                  onCheckedChange={(checked) => setIncludeSourceLocation(!!checked)}
                />
                <Label htmlFor="source" className="text-sm cursor-pointer">
                  Source locations (page, section, exact text)
                </Label>
              </div>
              {hasAgentData && (
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="comparison" 
                    checked={includeAgentComparison}
                    onCheckedChange={(checked) => setIncludeAgentComparison(!!checked)}
                  />
                  <Label htmlFor="comparison" className="text-sm cursor-pointer">
                    Multi-agent comparison (all {agentExtractions?.length} providers)
                  </Label>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleExport} disabled={!extractedData}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Helper functions for export generation

function flattenExtractedData(data: any, prefix = ''): Record<string, any> {
  const result: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(data)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    
    if (Array.isArray(value)) {
      value.forEach((item, idx) => {
        if (item && typeof item === 'object') {
          Object.assign(result, flattenExtractedData(item, `${fullKey}[${idx}]`));
        }
      });
    } else if (value && typeof value === 'object') {
      if ('content' in value || 'value' in value) {
        // This is an extracted field
        result[fullKey] = value;
      } else {
        // Nested object
        Object.assign(result, flattenExtractedData(value, fullKey));
      }
    }
  }
  
  return result;
}

function generateSingleExport(
  data: ExtractedData | ClinicalStudyExtraction,
  format: ExportFormat,
  includeConfidence: boolean,
  includeSourceLocation: boolean
): string {
  const flattened = flattenExtractedData(data);
  
  if (format === 'json') {
    return JSON.stringify(data, null, 2);
  }
  
  const separator = format === 'tsv' ? '\t' : ',';
  const rows: string[][] = [];
  
  // Header row
  const headers = ['Field', 'Value'];
  if (includeConfidence) headers.push('Confidence');
  if (includeSourceLocation) headers.push('Page', 'Section', 'Exact Text');
  rows.push(headers);
  
  // Data rows
  for (const [field, fieldData] of Object.entries(flattened)) {
    if (!fieldData) continue;
    
    const value = fieldData.content ?? fieldData.value ?? '';
    const row = [field, escapeValue(String(value), separator)];
    
    if (includeConfidence) {
      row.push(fieldData.confidence || '');
    }
    
    if (includeSourceLocation) {
      const loc = fieldData.source_location || fieldData.location;
      row.push(
        loc?.page?.toString() || '',
        loc?.section || '',
        escapeValue(loc?.exact_text_reference || loc?.exact || '', separator)
      );
    }
    
    rows.push(row);
  }
  
  return rows.map(row => row.join(separator)).join('\n');
}

function generateComparisonExport(
  primaryData: ExtractedData | ClinicalStudyExtraction,
  agentExtractions: Array<{ provider: AIProvider; extractedData: ExtractedData | null }>,
  format: ExportFormat,
  includeConfidence: boolean,
  includeSourceLocation: boolean
): string {
  const primaryFlattened = flattenExtractedData(primaryData);
  
  if (format === 'json') {
    return JSON.stringify({
      primary: primaryData,
      agents: agentExtractions.reduce((acc, ae) => {
        acc[ae.provider] = ae.extractedData;
        return acc;
      }, {} as Record<string, any>),
    }, null, 2);
  }
  
  const separator = format === 'tsv' ? '\t' : ',';
  const rows: string[][] = [];
  
  // Header row
  const headers = ['Field', 'Consensus Value'];
  for (const ae of agentExtractions) {
    headers.push(`${ae.provider.toUpperCase()} Value`);
    if (includeConfidence) headers.push(`${ae.provider.toUpperCase()} Confidence`);
    if (includeSourceLocation) headers.push(`${ae.provider.toUpperCase()} Page`);
  }
  headers.push('Agreement');
  rows.push(headers);
  
  // Get all fields from all sources
  const allFields = new Set<string>();
  Object.keys(primaryFlattened).forEach(k => allFields.add(k));
  agentExtractions.forEach(ae => {
    if (ae.extractedData) {
      Object.keys(flattenExtractedData(ae.extractedData)).forEach(k => allFields.add(k));
    }
  });
  
  // Data rows
  for (const field of Array.from(allFields).sort()) {
    const primaryField = primaryFlattened[field];
    const primaryValue = primaryField?.content ?? primaryField?.value ?? '';
    
    const row = [field, escapeValue(String(primaryValue), separator)];
    
    const values: string[] = [];
    
    for (const ae of agentExtractions) {
      const agentFlattened = ae.extractedData ? flattenExtractedData(ae.extractedData) : {};
      const agentField = agentFlattened[field];
      const agentValue = agentField?.content ?? agentField?.value ?? '';
      
      row.push(escapeValue(String(agentValue), separator));
      values.push(String(agentValue));
      
      if (includeConfidence) {
        row.push(agentField?.confidence || '');
      }
      
      if (includeSourceLocation) {
        const loc = agentField?.source_location || agentField?.location;
        row.push(loc?.page?.toString() || '');
      }
    }
    
    // Calculate agreement
    const uniqueValues = new Set(values.filter(v => v !== ''));
    const agreement = uniqueValues.size <= 1 ? 'Full' : uniqueValues.size === values.length ? 'None' : 'Partial';
    row.push(agreement);
    
    rows.push(row);
  }
  
  return rows.map(row => row.join(separator)).join('\n');
}

function escapeValue(value: string, separator: string): string {
  if (!value) return '';
  
  // Escape quotes and wrap in quotes if contains separator, newline, or quote
  if (value.includes(separator) || value.includes('\n') || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  
  return value;
}
