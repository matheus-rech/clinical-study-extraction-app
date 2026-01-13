import { useState } from 'react';
import { Eye, CheckCircle2, Loader2, Sparkles, FileSearch, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { ExtractionSchema, ExtractedData, LocationData } from '../../../drizzle/schema';

interface ExtractionSidebarProps {
  schema: ExtractionSchema;
  extractedData: ExtractedData | null;
  isExtracting: boolean;
  isSummarizing: boolean;
  onExtract: () => void;
  onSummarize: () => void;
  onViewSource: (fieldName: string, location: LocationData) => void;
  onUpdateField: (fieldName: string, value: string) => void;
  onEditSchema: () => void;
  disabled?: boolean;
}

export function ExtractionSidebar({
  schema,
  extractedData,
  isExtracting,
  isSummarizing,
  onExtract,
  onSummarize,
  onViewSource,
  onUpdateField,
  onEditSchema,
  disabled = false,
}: ExtractionSidebarProps) {
  return (
    <div className="w-[380px] bg-white border-l flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b bg-slate-50">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-slate-800">Extractions</h2>
          <Button variant="ghost" size="icon" onClick={onEditSchema} title="Edit extraction schema">
            <Settings2 className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={onSummarize}
            disabled={disabled || isSummarizing || isExtracting}
            variant="outline"
            className="flex-1"
          >
            {isSummarizing ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <FileSearch className="h-4 w-4 mr-2 text-orange-500" />
            )}
            Summarize
          </Button>
          <Button
            onClick={onExtract}
            disabled={disabled || isExtracting || isSummarizing}
            className="flex-1 bg-purple-600 hover:bg-purple-700"
          >
            {isExtracting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            {isExtracting ? 'Extracting...' : 'Auto-Extract'}
          </Button>
        </div>
      </div>

      {/* Fields */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {schema.fields.map((field) => (
            <ExtractionField
              key={field.name}
              field={field}
              data={extractedData?.[field.name]}
              onViewSource={(location) => onViewSource(field.name, location)}
              onUpdate={(value) => onUpdateField(field.name, value)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface ExtractionFieldProps {
  field: {
    name: string;
    label: string;
    type: 'text' | 'textarea' | 'number';
    description?: string;
  };
  data?: {
    value: string;
    location?: LocationData;
  };
  onViewSource: (location: LocationData) => void;
  onUpdate: (value: string) => void;
}

function ExtractionField({ field, data, onViewSource, onUpdate }: ExtractionFieldProps) {
  const hasSource = !!data?.location;
  const value = data?.value || '';

  return (
    <div className={cn(
      'p-4 rounded-lg border transition-all',
      hasSource ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200 bg-white'
    )}>
      <div className="flex items-center justify-between mb-2">
        <Label className="text-sm font-semibold text-slate-700">{field.label}</Label>
        <div className="flex gap-1">
          {hasSource && data?.location && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-emerald-600 hover:bg-emerald-100"
              onClick={() => onViewSource(data.location!)}
              title="View source in PDF"
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
      
      {field.description && (
        <p className="text-xs text-slate-500 mb-2">{field.description}</p>
      )}
      
      {field.type === 'textarea' ? (
        <Textarea
          value={value}
          onChange={(e) => onUpdate(e.target.value)}
          className="min-h-[80px] text-sm bg-white"
          placeholder={`Enter ${field.label.toLowerCase()}...`}
        />
      ) : (
        <Input
          type={field.type}
          value={value}
          onChange={(e) => onUpdate(e.target.value)}
          className="text-sm bg-white"
          placeholder={`Enter ${field.label.toLowerCase()}...`}
        />
      )}
      
      {hasSource && data?.location && (
        <div className="mt-2 flex items-center gap-1.5 text-[10px] font-semibold text-emerald-600 uppercase">
          <CheckCircle2 className="h-3 w-3" />
          Linked to Page {data.location.page}
        </div>
      )}
    </div>
  );
}
