import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { 
  CheckCircle2, AlertCircle, HelpCircle, Loader2, 
  Check, X, Eye, ChevronDown, ChevronUp,
  Sparkles, Bot, Zap
} from 'lucide-react';
import type { ExtractedData, Confidence, AIProvider } from '../../../drizzle/schema';

interface AgentExtractionResult {
  provider: AIProvider;
  extractedData: ExtractedData | null;
  status: 'pending' | 'extracting' | 'completed' | 'failed';
  error?: string;
}

interface AgentComparisonViewProps {
  agentExtractions: AgentExtractionResult[];
  consensusData: ExtractedData | null;
  onSelectConsensus: (data: ExtractedData) => void;
  onViewSource: (page: number, exactText: string) => void;
  isLoading: boolean;
}

const providerConfig: Record<AIProvider, { label: string; color: string; bg: string; icon: typeof Sparkles }> = {
  gemini: { label: 'Google Gemini', color: 'text-blue-600', bg: 'bg-blue-50', icon: Sparkles },
  claude: { label: 'Anthropic Claude', color: 'text-orange-600', bg: 'bg-orange-50', icon: Bot },
  openrouter: { label: 'OpenRouter', color: 'text-purple-600', bg: 'bg-purple-50', icon: Zap },
};

const confidenceConfig: Record<Confidence, { color: string; icon: typeof CheckCircle2 }> = {
  high: { color: 'text-emerald-600', icon: CheckCircle2 },
  medium: { color: 'text-amber-600', icon: HelpCircle },
  low: { color: 'text-red-500', icon: AlertCircle },
};

export function AgentComparisonView({
  agentExtractions,
  consensusData,
  onSelectConsensus,
  onViewSource,
  isLoading,
}: AgentComparisonViewProps) {
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());

  // Get all unique field names across all extractions
  const allFieldsSet = new Set<string>();
  agentExtractions.forEach(ae => {
    if (ae.extractedData) {
      Object.keys(ae.extractedData).forEach(k => allFieldsSet.add(k));
    }
  });
  const allFields = Array.from(allFieldsSet);

  // Calculate agreement statistics
  const calculateAgreement = () => {
    if (agentExtractions.length === 0) return { full: 0, partial: 0, none: 0, total: 0 };
    
    let full = 0, partial = 0, none = 0;
    
    for (const field of allFields) {
      const values = agentExtractions
        .filter(ae => ae.extractedData)
        .map(ae => {
          const fd = ae.extractedData?.[field];
          return fd?.value ?? (fd as any)?.content ?? '';
        })
        .filter(v => v !== '');
      
      if (values.length === 0) continue;
      
      const uniqueValues = new Set(values.map(v => String(v).toLowerCase().trim()));
      if (uniqueValues.size === 1) {
        full++;
      } else if (uniqueValues.size < values.length) {
        partial++;
      } else {
        none++;
      }
    }
    
    return { full, partial, none, total: full + partial + none };
  };

  const agreement = calculateAgreement();
  const agreementPercent = agreement.total > 0 
    ? Math.round((agreement.full / agreement.total) * 100) 
    : 0;

  const toggleField = (field: string) => {
    setExpandedFields(prev => {
      const next = new Set(prev);
      if (next.has(field)) {
        next.delete(field);
      } else {
        next.add(field);
      }
      return next;
    });
  };

  const getFieldAgreement = (field: string): 'full' | 'partial' | 'none' => {
    const values = agentExtractions
      .filter(ae => ae.extractedData)
      .map(ae => {
        const fd = ae.extractedData?.[field];
        return fd?.value ?? (fd as any)?.content ?? '';
      })
      .filter(v => v !== '');
    
    if (values.length === 0) return 'none';
    
    const uniqueValues = new Set(values.map(v => String(v).toLowerCase().trim()));
    if (uniqueValues.size === 1) return 'full';
    if (uniqueValues.size < values.length) return 'partial';
    return 'none';
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="p-4 border-b bg-white">
        <h2 className="text-lg font-semibold text-slate-800 mb-2">Multi-Agent Comparison</h2>
        <p className="text-sm text-slate-500 mb-3">
          Compare extractions from 3 AI providers for inter-rater reliability
        </p>
        
        {/* Agent Status Cards */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {agentExtractions.map(ae => {
            const config = providerConfig[ae.provider];
            const Icon = config.icon;
            return (
              <div 
                key={ae.provider}
                className={cn(
                  'p-2 rounded-lg border text-center',
                  ae.status === 'completed' ? config.bg : 'bg-slate-50'
                )}
              >
                <Icon className={cn('h-4 w-4 mx-auto mb-1', config.color)} />
                <p className="text-xs font-medium truncate">{config.label.split(' ')[1]}</p>
                <Badge 
                  variant="secondary" 
                  className={cn(
                    'text-[10px] mt-1',
                    ae.status === 'completed' && 'bg-emerald-100 text-emerald-700',
                    ae.status === 'extracting' && 'bg-blue-100 text-blue-700',
                    ae.status === 'failed' && 'bg-red-100 text-red-700',
                    ae.status === 'pending' && 'bg-slate-100 text-slate-500'
                  )}
                >
                  {ae.status === 'extracting' && <Loader2 className="h-2 w-2 mr-1 animate-spin" />}
                  {ae.status}
                </Badge>
              </div>
            );
          })}
        </div>

        {/* Agreement Stats */}
        {!isLoading && agreement.total > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-slate-500">
              <span>Inter-rater Agreement</span>
              <span>{agreementPercent}% ({agreement.full}/{agreement.total} fields)</span>
            </div>
            <Progress value={agreementPercent} className="h-2" />
            <div className="flex gap-4 text-xs">
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                Full: {agreement.full}
              </span>
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                Partial: {agreement.partial}
              </span>
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                None: {agreement.none}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-3" />
            <p className="text-sm text-slate-600">Extracting with 3 AI agents...</p>
            <p className="text-xs text-slate-400 mt-1">This may take a minute</p>
          </div>
        </div>
      )}

      {/* Field Comparison List */}
      {!isLoading && (
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-2">
            {allFields.sort().map(field => {
              const fieldAgreement = getFieldAgreement(field);
              const isExpanded = expandedFields.has(field);
              
              return (
                <Card key={field} className="overflow-hidden">
                  <button
                    className="w-full p-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
                    onClick={() => toggleField(field)}
                  >
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        'w-2 h-2 rounded-full',
                        fieldAgreement === 'full' && 'bg-emerald-500',
                        fieldAgreement === 'partial' && 'bg-amber-500',
                        fieldAgreement === 'none' && 'bg-red-500'
                      )} />
                      <span className="text-sm font-medium text-slate-700">{field}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {fieldAgreement === 'full' ? 'Agree' : fieldAgreement === 'partial' ? 'Partial' : 'Disagree'}
                      </Badge>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      )}
                    </div>
                  </button>
                  
                  {isExpanded && (
                    <CardContent className="pt-0 pb-3 px-3 space-y-2 border-t">
                      {agentExtractions.map(ae => {
                        if (!ae.extractedData) return null;
                        
                        const fieldData = ae.extractedData[field];
                        if (!fieldData) return null;
                        
                        const value = fieldData.value ?? (fieldData as any).content ?? '';
                        const confidence = fieldData.confidence || 'medium';
                        const config = providerConfig[ae.provider];
                        const confConfig = confidenceConfig[confidence];
                        const ConfIcon = confConfig.icon;
                        const hasSource = fieldData.source_location?.page || fieldData.location?.page;
                        
                        return (
                          <div 
                            key={ae.provider}
                            className={cn('p-2 rounded-lg border', config.bg)}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className={cn('text-xs font-medium', config.color)}>
                                {config.label}
                              </span>
                              <div className="flex items-center gap-1">
                                <Tooltip>
                                  <TooltipTrigger>
                                    <ConfIcon className={cn('h-3 w-3', confConfig.color)} />
                                  </TooltipTrigger>
                                  <TooltipContent>{confidence} confidence</TooltipContent>
                                </Tooltip>
                                {hasSource && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const page = fieldData.source_location?.page || fieldData.location?.page || 1;
                                      const text = fieldData.source_location?.exact_text_reference || fieldData.location?.exact || '';
                                      onViewSource(page, text);
                                    }}
                                  >
                                    <Eye className="h-3 w-3" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5 text-emerald-600 hover:text-emerald-700"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // Create consensus with this value
                                    const newConsensus = { ...consensusData, [field]: fieldData };
                                    onSelectConsensus(newConsensus as ExtractedData);
                                  }}
                                  title="Use this value"
                                >
                                  <Check className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                            <p className="text-sm text-slate-700 break-words">
                              {String(value) || <span className="text-slate-400 italic">No value</span>}
                            </p>
                            {fieldData.source_location?.exact_text_reference && (
                              <p className="text-xs text-slate-500 mt-1 italic line-clamp-2">
                                "{fieldData.source_location.exact_text_reference}"
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </CardContent>
                  )}
                </Card>
              );
            })}
            
            {allFields.length === 0 && !isLoading && (
              <div className="text-center py-8">
                <Bot className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-500">No extractions yet</p>
                <p className="text-xs text-slate-400 mt-1">
                  Click "3-Agent Extract" to start multi-agent extraction
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
