import { Eye, CheckCircle2, Loader2, Sparkles, FileSearch, Settings2, AlertCircle, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { ExtractionSchema, ExtractionField as SchemaField, ExtractedFieldData, LocationData, Confidence, SourceLocation } from '../../../drizzle/schema';

interface ExtractionSidebarProps {
  schema: ExtractionSchema;
  extractedData: Record<string, ExtractedFieldData> | null;
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
    <div className="w-[400px] bg-white border-l flex flex-col h-full">
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
            <ExtractionFieldComponent
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

interface ExtractionFieldComponentProps {
  field: SchemaField;
  data?: ExtractedFieldData;
  onViewSource: (location: LocationData) => void;
  onUpdate: (value: string) => void;
}

const confidenceConfig: Record<Confidence, { color: string; bg: string; label: string; icon: typeof CheckCircle2 }> = {
  high: { color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', label: 'High confidence', icon: CheckCircle2 },
  medium: { color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', label: 'Medium confidence', icon: HelpCircle },
  low: { color: 'text-red-500', bg: 'bg-red-50 border-red-200', label: 'Low confidence', icon: AlertCircle },
};

function ExtractionFieldComponent({ field, data, onViewSource, onUpdate }: ExtractionFieldComponentProps) {
  const hasSource = !!(data?.location || data?.source_location);
  const confidence = data?.confidence || 'low';
  const config = confidenceConfig[confidence];
  const ConfidenceIcon = config.icon;
  
  // Get display value
  const value = data?.value !== undefined ? String(data.value) : '';
  
  // Get source location for display
  const sourceLocation = data?.source_location;
  const legacyLocation = data?.location;

  const handleViewSource = () => {
    if (legacyLocation) {
      onViewSource(legacyLocation);
    } else if (sourceLocation) {
      // Convert source_location to LocationData for PDF highlighting
      const location: LocationData = {
        page: sourceLocation.page,
        exact: sourceLocation.exact_text_reference || '',
        rects: [],
        selector: {
          type: 'FragmentSelector',
          conformsTo: 'http://tools.ietf.org/rfc/rfc3778',
          value: `page=${sourceLocation.page}`,
        },
      };
      onViewSource(location);
    }
  };

  return (
    <div className={cn(
      'p-4 rounded-lg border transition-all',
      data && value ? config.bg : 'border-slate-200 bg-white'
    )}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-semibold text-slate-700">{field.label}</Label>
          {field.required && <span className="text-red-500 text-xs">*</span>}
        </div>
        <div className="flex items-center gap-1">
          {/* Confidence indicator */}
          {data && value && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={cn('flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', config.color)}>
                  <ConfidenceIcon className="h-3 w-3" />
                  <span className="capitalize">{confidence}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-[250px]">
                <p className="font-medium">{config.label}</p>
                {data.notes && <p className="text-xs mt-1 text-slate-500">{data.notes}</p>}
              </TooltipContent>
            </Tooltip>
          )}
          
          {/* View source button */}
          {hasSource && (
            <Button
              variant="ghost"
              size="icon"
              className={cn('h-7 w-7', config.color, 'hover:bg-white/50')}
              onClick={handleViewSource}
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
      ) : field.type === 'boolean' ? (
        <div className="flex gap-2">
          <Button
            variant={value === 'true' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onUpdate('true')}
            className="flex-1"
          >
            Yes
          </Button>
          <Button
            variant={value === 'false' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onUpdate('false')}
            className="flex-1"
          >
            No
          </Button>
        </div>
      ) : (
        <Input
          type={field.type === 'number' || field.type === 'integer' ? 'number' : 'text'}
          value={value}
          onChange={(e) => onUpdate(e.target.value)}
          className="text-sm bg-white"
          placeholder={`Enter ${field.label.toLowerCase()}...`}
        />
      )}
      
      {/* Source location info */}
      {sourceLocation && (
        <div className="mt-2 space-y-1">
          <div className={cn('flex items-center gap-1.5 text-[10px] font-semibold uppercase', config.color)}>
            <ConfidenceIcon className="h-3 w-3" />
            Page {sourceLocation.page}
            {sourceLocation.section && ` · ${sourceLocation.section}`}
          </div>
          {sourceLocation.exact_text_reference && (
            <p className="text-xs text-slate-500 italic line-clamp-2">
              "{sourceLocation.exact_text_reference}"
            </p>
          )}
        </div>
      )}
      
      {/* Legacy location display */}
      {!sourceLocation && legacyLocation && (
        <div className={cn('mt-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase', config.color)}>
          <CheckCircle2 className="h-3 w-3" />
          Linked to Page {legacyLocation.page}
        </div>
      )}
    </div>
  );
}
