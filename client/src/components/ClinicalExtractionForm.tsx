import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { 
  ChevronLeft, ChevronRight, Plus, Trash2, Eye, 
  CheckCircle2, HelpCircle, AlertCircle, FileText,
  Users, Stethoscope, Activity, FlaskConical, Target, AlertTriangle, Check
} from 'lucide-react';
import type { 
  ClinicalStudyExtraction, ExtractedField, Confidence, SourceLocation,
  StudyId, PicoT, Baseline, Imaging, Interventions, StudyArm, Outcomes, Complications, ExtractedItem
} from '../../../drizzle/schema';

interface ClinicalExtractionFormProps {
  data: Partial<ClinicalStudyExtraction> | null;
  onUpdate: (path: string, value: any) => void;
  onViewSource: (page: number, exactText: string) => void;
  isReadOnly?: boolean;
}

// Section/Step configuration
const steps = [
  { id: 'studyId', title: 'Study ID', shortTitle: '1. ID', icon: FileText, color: 'text-blue-600', bgColor: 'bg-blue-50' },
  { id: 'picoT', title: 'PICO-T Framework', shortTitle: '2. PICO-T', icon: Target, color: 'text-purple-600', bgColor: 'bg-purple-50' },
  { id: 'baseline', title: 'Baseline Demographics', shortTitle: '3. Baseline', icon: Users, color: 'text-green-600', bgColor: 'bg-green-50' },
  { id: 'imaging', title: 'Imaging', shortTitle: '4. Imaging', icon: Activity, color: 'text-cyan-600', bgColor: 'bg-cyan-50' },
  { id: 'interventions', title: 'Interventions', shortTitle: '5. Interventions', icon: FlaskConical, color: 'text-orange-600', bgColor: 'bg-orange-50' },
  { id: 'studyArms', title: 'Study Arms', shortTitle: '6. Arms', icon: Users, color: 'text-indigo-600', bgColor: 'bg-indigo-50' },
  { id: 'outcomes', title: 'Outcomes', shortTitle: '7. Outcomes', icon: Stethoscope, color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
  { id: 'complications', title: 'Complications', shortTitle: '8. Complications', icon: AlertTriangle, color: 'text-red-600', bgColor: 'bg-red-50' },
];

const confidenceConfig: Record<Confidence, { color: string; bg: string; icon: typeof CheckCircle2 }> = {
  high: { color: 'text-emerald-600', bg: 'bg-emerald-50', icon: CheckCircle2 },
  medium: { color: 'text-amber-600', bg: 'bg-amber-50', icon: HelpCircle },
  low: { color: 'text-red-500', bg: 'bg-red-50', icon: AlertCircle },
};

export function ClinicalExtractionForm({
  data,
  onUpdate,
  onViewSource,
  isReadOnly = false,
}: ClinicalExtractionFormProps) {
  const [currentStep, setCurrentStep] = useState(0);

  // Calculate progress for each step
  const getStepProgress = (stepId: string) => {
    const stepData = data?.[stepId as keyof ClinicalStudyExtraction];
    if (!stepData) return { filled: 0, total: 0 };
    const { filled, total } = countFieldsInObject(stepData);
    return { filled, total };
  };

  // Calculate overall progress
  const overallProgress = steps.reduce((acc, step) => {
    const { filled, total } = getStepProgress(step.id);
    return { filled: acc.filled + filled, total: acc.total + total };
  }, { filled: 0, total: 0 });

  const progressPercent = overallProgress.total > 0 
    ? Math.round((overallProgress.filled / overallProgress.total) * 100) 
    : 0;

  const currentStepData = steps[currentStep];

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header with overall progress */}
      <div className="p-4 border-b bg-white">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-slate-800">Clinical Extraction</h2>
          <Badge variant="secondary" className="text-xs">
            {overallProgress.filled}/{overallProgress.total} fields
          </Badge>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-slate-500">
            <span>Overall Progress</span>
            <span>{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>
      </div>

      {/* Step Navigation */}
      <div className="p-2 border-b bg-white overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {steps.map((step, idx) => {
            const { filled, total } = getStepProgress(step.id);
            const isComplete = total > 0 && filled === total;
            const isCurrent = idx === currentStep;
            const Icon = step.icon;
            
            return (
              <Button
                key={step.id}
                variant={isCurrent ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setCurrentStep(idx)}
                className={cn(
                  'flex-shrink-0 gap-1.5 text-xs h-8',
                  isCurrent && step.bgColor,
                  isCurrent && step.color,
                  !isCurrent && 'text-slate-600'
                )}
              >
                {isComplete ? (
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <Icon className={cn('h-3.5 w-3.5', isCurrent ? step.color : 'text-slate-400')} />
                )}
                <span className="hidden sm:inline">{step.shortTitle}</span>
                <span className="sm:hidden">{idx + 1}</span>
                {total > 0 && (
                  <span className={cn(
                    'text-[10px] px-1 rounded',
                    isComplete ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                  )}>
                    {filled}/{total}
                  </span>
                )}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Current Step Content */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-4">
              {(() => {
                const Icon = currentStepData.icon;
                return <Icon className={cn('h-5 w-5', currentStepData.color)} />;
              })()}
              <h3 className="text-base font-semibold text-slate-800">{currentStepData.title}</h3>
            </div>
            
            {renderStepContent(
              currentStepData.id,
              data?.[currentStepData.id as keyof ClinicalStudyExtraction],
              (path, value) => onUpdate(`${currentStepData.id}.${path}`, value),
              onViewSource,
              isReadOnly
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Step Navigation Footer */}
      <div className="p-3 border-t bg-white flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
          disabled={currentStep === 0}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Previous
        </Button>
        
        <span className="text-sm text-slate-500">
          Step {currentStep + 1} of {steps.length}
        </span>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentStep(Math.min(steps.length - 1, currentStep + 1))}
          disabled={currentStep === steps.length - 1}
        >
          Next
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

function renderStepContent(
  stepId: string, 
  data: any, 
  onUpdate: (path: string, value: any) => void,
  onViewSource: (page: number, exactText: string) => void,
  isReadOnly: boolean
) {
  switch (stepId) {
    case 'studyId':
      return <StudyIdStep data={data} onUpdate={onUpdate} onViewSource={onViewSource} isReadOnly={isReadOnly} />;
    case 'picoT':
      return <PicoTStep data={data} onUpdate={onUpdate} onViewSource={onViewSource} isReadOnly={isReadOnly} />;
    case 'baseline':
      return <BaselineStep data={data} onUpdate={onUpdate} onViewSource={onViewSource} isReadOnly={isReadOnly} />;
    case 'imaging':
      return <ImagingStep data={data} onUpdate={onUpdate} onViewSource={onViewSource} isReadOnly={isReadOnly} />;
    case 'interventions':
      return <InterventionsStep data={data} onUpdate={onUpdate} onViewSource={onViewSource} isReadOnly={isReadOnly} />;
    case 'studyArms':
      return <StudyArmsStep data={data} onUpdate={onUpdate} onViewSource={onViewSource} isReadOnly={isReadOnly} />;
    case 'outcomes':
      return <OutcomesStep data={data} onUpdate={onUpdate} onViewSource={onViewSource} isReadOnly={isReadOnly} />;
    case 'complications':
      return <ComplicationsStep data={data} onUpdate={onUpdate} onViewSource={onViewSource} isReadOnly={isReadOnly} />;
    default:
      return <p className="text-sm text-slate-500">Step not implemented</p>;
  }
}

// Reusable extracted field component
interface ExtractedFieldInputProps {
  label: string;
  field?: ExtractedField<any>;
  type?: 'text' | 'textarea' | 'number' | 'boolean' | 'tristate';
  required?: boolean;
  onUpdate: (value: any) => void;
  onViewSource: (page: number, exactText: string) => void;
  isReadOnly: boolean;
  className?: string;
}

function ExtractedFieldInput({ 
  label, field, type = 'text', required, onUpdate, onViewSource, isReadOnly, className 
}: ExtractedFieldInputProps) {
  const confidence = field?.confidence || 'low';
  const config = confidenceConfig[confidence];
  const ConfIcon = config.icon;
  const hasSource = field?.source_location?.page;
  const value = field?.content !== undefined ? field.content : '';

  const updateField = (newContent: any) => {
    onUpdate({
      content: newContent,
      source_location: field?.source_location || { page: 1 },
      confidence: field?.confidence || 'medium',
      notes: field?.notes,
    });
  };

  return (
    <div className={cn(
      'p-3 rounded-lg border transition-all',
      field?.content !== undefined && field?.content !== '' ? config.bg : 'bg-white border-slate-200',
      className
    )}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium text-slate-700">{label}</Label>
          {required && <span className="text-red-500 text-xs">*</span>}
        </div>
        <div className="flex items-center gap-1">
          {field?.content !== undefined && field?.content !== '' && (
            <Tooltip>
              <TooltipTrigger>
                <div className={cn('flex items-center gap-1 px-2 py-0.5 rounded-full text-xs', config.color)}>
                  <ConfIcon className="h-3 w-3" />
                  <span className="capitalize">{confidence}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-[250px]">
                <p className="font-medium">{confidence} confidence</p>
                {field?.notes && <p className="text-xs mt-1">{field.notes}</p>}
              </TooltipContent>
            </Tooltip>
          )}
          {hasSource && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onViewSource(
                field!.source_location!.page,
                field!.source_location!.exact_text_reference || ''
              )}
              title={`View source (p.${field!.source_location!.page})`}
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {type === 'textarea' ? (
        <Textarea
          value={String(value)}
          onChange={(e) => updateField(e.target.value)}
          className="min-h-[60px] text-sm bg-white"
          disabled={isReadOnly}
          placeholder={`Enter ${label.toLowerCase()}...`}
        />
      ) : type === 'boolean' ? (
        <div className="flex items-center gap-4">
          <Switch
            checked={value === true}
            onCheckedChange={(checked) => updateField(checked)}
            disabled={isReadOnly}
          />
          <span className="text-sm text-slate-600">{value === true ? 'Yes' : value === false ? 'No' : 'Not set'}</span>
        </div>
      ) : type === 'tristate' ? (
        <div className="flex gap-2">
          {[{ v: true, l: 'Yes' }, { v: false, l: 'No' }, { v: null, l: 'N/A' }].map(opt => (
            <Button
              key={String(opt.v)}
              variant={value === opt.v ? 'default' : 'outline'}
              size="sm"
              onClick={() => updateField(opt.v)}
              disabled={isReadOnly}
              className="flex-1"
            >
              {opt.l}
            </Button>
          ))}
        </div>
      ) : type === 'number' ? (
        <Input
          type="number"
          value={value !== '' && value !== undefined ? String(value) : ''}
          onChange={(e) => updateField(e.target.value ? parseFloat(e.target.value) : undefined)}
          className="text-sm bg-white"
          disabled={isReadOnly}
          placeholder="0"
        />
      ) : (
        <Input
          type="text"
          value={String(value || '')}
          onChange={(e) => updateField(e.target.value)}
          className="text-sm bg-white"
          disabled={isReadOnly}
          placeholder={`Enter ${label.toLowerCase()}...`}
        />
      )}

      {field?.source_location?.exact_text_reference && (
        <p className="text-xs text-slate-500 mt-2 italic border-l-2 border-slate-200 pl-2 line-clamp-2">
          "{field.source_location.exact_text_reference}"
        </p>
      )}
    </div>
  );
}

// Field group component for nested objects
interface FieldGroupProps {
  title: string;
  children: React.ReactNode;
}

function FieldGroup({ title, children }: FieldGroupProps) {
  return (
    <Card className="mb-4">
      <CardContent className="pt-4">
        <Label className="text-sm font-semibold text-slate-700 mb-3 block">{title}</Label>
        <div className="space-y-3">
          {children}
        </div>
      </CardContent>
    </Card>
  );
}

// Step Components
function StudyIdStep({ data, onUpdate, onViewSource, isReadOnly }: any) {
  const studyId = data as StudyId | undefined;
  return (
    <div className="space-y-3">
      <ExtractedFieldInput label="Citation" field={studyId?.citation} required onUpdate={(v) => onUpdate('citation', v)} onViewSource={onViewSource} isReadOnly={isReadOnly} />
      <div className="grid grid-cols-2 gap-3">
        <ExtractedFieldInput label="DOI" field={studyId?.doi} onUpdate={(v) => onUpdate('doi', v)} onViewSource={onViewSource} isReadOnly={isReadOnly} />
        <ExtractedFieldInput label="PMID" field={studyId?.pmid} onUpdate={(v) => onUpdate('pmid', v)} onViewSource={onViewSource} isReadOnly={isReadOnly} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <ExtractedFieldInput label="Journal" field={studyId?.journal} onUpdate={(v) => onUpdate('journal', v)} onViewSource={onViewSource} isReadOnly={isReadOnly} />
        <ExtractedFieldInput label="Year" field={studyId?.year} type="number" onUpdate={(v) => onUpdate('year', v)} onViewSource={onViewSource} isReadOnly={isReadOnly} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <ExtractedFieldInput label="Country" field={studyId?.country} onUpdate={(v) => onUpdate('country', v)} onViewSource={onViewSource} isReadOnly={isReadOnly} />
        <ExtractedFieldInput label="Centers" field={studyId?.centers} onUpdate={(v) => onUpdate('centers', v)} onViewSource={onViewSource} isReadOnly={isReadOnly} />
      </div>
      <ExtractedFieldInput label="Funding" field={studyId?.funding} type="textarea" onUpdate={(v) => onUpdate('funding', v)} onViewSource={onViewSource} isReadOnly={isReadOnly} />
      <ExtractedFieldInput label="Conflicts of Interest" field={studyId?.conflicts} type="textarea" onUpdate={(v) => onUpdate('conflicts', v)} onViewSource={onViewSource} isReadOnly={isReadOnly} />
      <ExtractedFieldInput label="Trial Registration" field={studyId?.registration} onUpdate={(v) => onUpdate('registration', v)} onViewSource={onViewSource} isReadOnly={isReadOnly} />
    </div>
  );
}

function PicoTStep({ data, onUpdate, onViewSource, isReadOnly }: any) {
  const picoT = data as PicoT | undefined;
  return (
    <div className="space-y-3">
      <ExtractedFieldInput label="Population (P)" field={picoT?.population} type="textarea" onUpdate={(v) => onUpdate('population', v)} onViewSource={onViewSource} isReadOnly={isReadOnly} />
      <ExtractedFieldInput label="Intervention (I)" field={picoT?.intervention} type="textarea" onUpdate={(v) => onUpdate('intervention', v)} onViewSource={onViewSource} isReadOnly={isReadOnly} />
      <ExtractedFieldInput label="Comparator (C)" field={picoT?.comparator} type="textarea" onUpdate={(v) => onUpdate('comparator', v)} onViewSource={onViewSource} isReadOnly={isReadOnly} />
      <ExtractedFieldInput label="Outcomes Measured (O)" field={picoT?.outcomesMeasured} type="textarea" onUpdate={(v) => onUpdate('outcomesMeasured', v)} onViewSource={onViewSource} isReadOnly={isReadOnly} />
      <ExtractedFieldInput label="Timing/Follow-up (T)" field={picoT?.timingFollowUp} onUpdate={(v) => onUpdate('timingFollowUp', v)} onViewSource={onViewSource} isReadOnly={isReadOnly} />
      <ExtractedFieldInput label="Study Type" field={picoT?.studyType} onUpdate={(v) => onUpdate('studyType', v)} onViewSource={onViewSource} isReadOnly={isReadOnly} />
      <ExtractedFieldInput label="Inclusion Criteria Met?" field={picoT?.inclusionMet} type="boolean" required onUpdate={(v) => onUpdate('inclusionMet', v)} onViewSource={onViewSource} isReadOnly={isReadOnly} />
    </div>
  );
}

function BaselineStep({ data, onUpdate, onViewSource, isReadOnly }: any) {
  const baseline = data as Baseline | undefined;
  return (
    <div className="space-y-4">
      <FieldGroup title="Sample Size">
        <div className="grid grid-cols-3 gap-3">
          <ExtractedFieldInput label="Total N" field={baseline?.sampleSize?.totalN} type="number" required onUpdate={(v) => onUpdate('sampleSize.totalN', v)} onViewSource={onViewSource} isReadOnly={isReadOnly} />
          <ExtractedFieldInput label="Surgical N" field={baseline?.sampleSize?.surgicalN} type="number" onUpdate={(v) => onUpdate('sampleSize.surgicalN', v)} onViewSource={onViewSource} isReadOnly={isReadOnly} />
          <ExtractedFieldInput label="Control N" field={baseline?.sampleSize?.controlN} type="number" onUpdate={(v) => onUpdate('sampleSize.controlN', v)} onViewSource={onViewSource} isReadOnly={isReadOnly} />
        </div>
      </FieldGroup>

      <FieldGroup title="Age">
        <div className="grid grid-cols-2 gap-3">
          <ExtractedFieldInput label="Mean" field={baseline?.age?.mean} type="number" onUpdate={(v) => onUpdate('age.mean', v)} onViewSource={onViewSource} isReadOnly={isReadOnly} />
          <ExtractedFieldInput label="SD" field={baseline?.age?.sd} type="number" onUpdate={(v) => onUpdate('age.sd', v)} onViewSource={onViewSource} isReadOnly={isReadOnly} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <ExtractedFieldInput label="Median" field={baseline?.age?.median} type="number" onUpdate={(v) => onUpdate('age.median', v)} onViewSource={onViewSource} isReadOnly={isReadOnly} />
          <div className="grid grid-cols-2 gap-2">
            <ExtractedFieldInput label="IQR Q1" field={baseline?.age?.iqr?.lowerQ1} type="number" onUpdate={(v) => onUpdate('age.iqr.lowerQ1', v)} onViewSource={onViewSource} isReadOnly={isReadOnly} />
            <ExtractedFieldInput label="IQR Q3" field={baseline?.age?.iqr?.upperQ3} type="number" onUpdate={(v) => onUpdate('age.iqr.upperQ3', v)} onViewSource={onViewSource} isReadOnly={isReadOnly} />
          </div>
        </div>
      </FieldGroup>

      <FieldGroup title="Gender">
        <div className="grid grid-cols-2 gap-3">
          <ExtractedFieldInput label="Male N" field={baseline?.gender?.maleN} type="number" onUpdate={(v) => onUpdate('gender.maleN', v)} onViewSource={onViewSource} isReadOnly={isReadOnly} />
          <ExtractedFieldInput label="Female N" field={baseline?.gender?.femaleN} type="number" onUpdate={(v) => onUpdate('gender.femaleN', v)} onViewSource={onViewSource} isReadOnly={isReadOnly} />
        </div>
      </FieldGroup>

      <FieldGroup title="Clinical Scores">
        <div className="grid grid-cols-3 gap-3">
          <ExtractedFieldInput label="Pre-stroke MRS" field={baseline?.clinicalScores?.prestrokeMRS} type="number" onUpdate={(v) => onUpdate('clinicalScores.prestrokeMRS', v)} onViewSource={onViewSource} isReadOnly={isReadOnly} />
          <ExtractedFieldInput label="NIHSS" field={baseline?.clinicalScores?.nihssMeanOrMedian} type="number" onUpdate={(v) => onUpdate('clinicalScores.nihssMeanOrMedian', v)} onViewSource={onViewSource} isReadOnly={isReadOnly} />
          <ExtractedFieldInput label="GCS" field={baseline?.clinicalScores?.gcsMeanOrMedian} type="number" onUpdate={(v) => onUpdate('clinicalScores.gcsMeanOrMedian', v)} onViewSource={onViewSource} isReadOnly={isReadOnly} />
        </div>
      </FieldGroup>
    </div>
  );
}

function ImagingStep({ data, onUpdate, onViewSource, isReadOnly }: any) {
  const imaging = data as Imaging | undefined;
  return (
    <div className="space-y-4">
      <ExtractedFieldInput label="Vascular Territory" field={imaging?.vascularTerritory} onUpdate={(v) => onUpdate('vascularTerritory', v)} onViewSource={onViewSource} isReadOnly={isReadOnly} />
      <ExtractedFieldInput label="Infarct Volume" field={imaging?.infarctVolume} type="number" onUpdate={(v) => onUpdate('infarctVolume', v)} onViewSource={onViewSource} isReadOnly={isReadOnly} />
      <ExtractedFieldInput label="Stroke Volume Cerebellum" field={imaging?.strokeVolumeCerebellum} onUpdate={(v) => onUpdate('strokeVolumeCerebellum', v)} onViewSource={onViewSource} isReadOnly={isReadOnly} />
      
      <FieldGroup title="Edema">
        <ExtractedFieldInput label="Description" field={imaging?.edema?.description} type="textarea" onUpdate={(v) => onUpdate('edema.description', v)} onViewSource={onViewSource} isReadOnly={isReadOnly} />
        <ExtractedFieldInput label="Peak Swelling Window" field={imaging?.edema?.peakSwellingWindow} onUpdate={(v) => onUpdate('edema.peakSwellingWindow', v)} onViewSource={onViewSource} isReadOnly={isReadOnly} />
      </FieldGroup>

      <FieldGroup title="Involvement Areas">
        <ExtractedFieldInput label="Brainstem Involvement" field={imaging?.involvementAreas?.brainstemInvolvement} type="tristate" onUpdate={(v) => onUpdate('involvementAreas.brainstemInvolvement', v)} onViewSource={onViewSource} isReadOnly={isReadOnly} />
        <ExtractedFieldInput label="Supratentorial Involvement" field={imaging?.involvementAreas?.supratentorialInvolvement} type="tristate" onUpdate={(v) => onUpdate('involvementAreas.supratentorialInvolvement', v)} onViewSource={onViewSource} isReadOnly={isReadOnly} />
        <ExtractedFieldInput label="Non-Cerebellar Stroke" field={imaging?.involvementAreas?.nonCerebellarStroke} type="tristate" onUpdate={(v) => onUpdate('involvementAreas.nonCerebellarStroke', v)} onViewSource={onViewSource} isReadOnly={isReadOnly} />
      </FieldGroup>
    </div>
  );
}

function InterventionsStep({ data, onUpdate, onViewSource, isReadOnly }: any) {
  const interventions = data as Interventions | undefined;
  return (
    <div className="space-y-4">
      <ArrayFieldSection
        label="Surgical Indications"
        items={interventions?.surgicalIndications || []}
        onUpdate={(items) => onUpdate('surgicalIndications', items)}
        onViewSource={onViewSource}
        isReadOnly={isReadOnly}
        renderItem={(item: ExtractedItem, idx, updateItem) => (
          <div className="space-y-2">
            <Input
              placeholder="Data type (e.g., clinical_indication)"
              value={item.data_type || ''}
              onChange={(e) => updateItem({ ...item, data_type: e.target.value })}
              disabled={isReadOnly}
              className="text-sm"
            />
            <Textarea
              placeholder="Content"
              value={String(item.content || '')}
              onChange={(e) => updateItem({ ...item, content: e.target.value })}
              disabled={isReadOnly}
              className="text-sm min-h-[60px]"
            />
          </div>
        )}
      />
      <ArrayFieldSection
        label="Intervention Types"
        items={interventions?.interventionTypes || []}
        onUpdate={(items) => onUpdate('interventionTypes', items)}
        onViewSource={onViewSource}
        isReadOnly={isReadOnly}
        renderItem={(item: ExtractedItem, idx, updateItem) => (
          <div className="space-y-2">
            <Input
              placeholder="Data type (e.g., surgical_procedure)"
              value={item.data_type || ''}
              onChange={(e) => updateItem({ ...item, data_type: e.target.value })}
              disabled={isReadOnly}
              className="text-sm"
            />
            <Textarea
              placeholder="Content"
              value={String(item.content || '')}
              onChange={(e) => updateItem({ ...item, content: e.target.value })}
              disabled={isReadOnly}
              className="text-sm min-h-[60px]"
            />
          </div>
        )}
      />
    </div>
  );
}

function StudyArmsStep({ data, onUpdate, onViewSource, isReadOnly }: any) {
  const arms = (data || []) as StudyArm[];
  return (
    <ArrayFieldSection
      label="Study Arms"
      items={arms}
      onUpdate={(items) => onUpdate('', items)}
      onViewSource={onViewSource}
      isReadOnly={isReadOnly}
      renderItem={(arm: StudyArm, idx, updateItem) => (
        <div className="space-y-2">
          <ExtractedFieldInput label="Arm ID" field={arm.armId} onUpdate={(v) => updateItem({ ...arm, armId: v })} onViewSource={onViewSource} isReadOnly={isReadOnly} />
          <ExtractedFieldInput label="Label" field={arm.label} onUpdate={(v) => updateItem({ ...arm, label: v })} onViewSource={onViewSource} isReadOnly={isReadOnly} />
          <ExtractedFieldInput label="Description" field={arm.description} type="textarea" onUpdate={(v) => updateItem({ ...arm, description: v })} onViewSource={onViewSource} isReadOnly={isReadOnly} />
        </div>
      )}
    />
  );
}

function OutcomesStep({ data, onUpdate, onViewSource, isReadOnly }: any) {
  const outcomes = data as Outcomes | undefined;
  return (
    <div className="space-y-4">
      <ArrayFieldSection
        label="Mortality Outcomes"
        items={outcomes?.mortality || []}
        onUpdate={(items) => onUpdate('mortality', items)}
        onViewSource={onViewSource}
        isReadOnly={isReadOnly}
        renderItem={(item: any, idx, updateItem) => (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <ExtractedFieldInput label="Arm ID" field={item.armId} onUpdate={(v) => updateItem({ ...item, armId: v })} onViewSource={onViewSource} isReadOnly={isReadOnly} />
              <ExtractedFieldInput label="Timepoint" field={item.timepoint} onUpdate={(v) => updateItem({ ...item, timepoint: v })} onViewSource={onViewSource} isReadOnly={isReadOnly} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <ExtractedFieldInput label="Deaths N" field={item.deathsN} type="number" onUpdate={(v) => updateItem({ ...item, deathsN: v })} onViewSource={onViewSource} isReadOnly={isReadOnly} />
              <ExtractedFieldInput label="Total N" field={item.totalN} type="number" onUpdate={(v) => updateItem({ ...item, totalN: v })} onViewSource={onViewSource} isReadOnly={isReadOnly} />
            </div>
            <ExtractedFieldInput label="Notes" field={item.notes} type="textarea" onUpdate={(v) => updateItem({ ...item, notes: v })} onViewSource={onViewSource} isReadOnly={isReadOnly} />
          </div>
        )}
      />
      <ArrayFieldSection
        label="MRS Outcomes"
        items={outcomes?.mrs || []}
        onUpdate={(items) => onUpdate('mrs', items)}
        onViewSource={onViewSource}
        isReadOnly={isReadOnly}
        renderItem={(item: any, idx, updateItem) => (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <ExtractedFieldInput label="Arm ID" field={item.armId} onUpdate={(v) => updateItem({ ...item, armId: v })} onViewSource={onViewSource} isReadOnly={isReadOnly} />
              <ExtractedFieldInput label="Timepoint" field={item.timepoint} onUpdate={(v) => updateItem({ ...item, timepoint: v })} onViewSource={onViewSource} isReadOnly={isReadOnly} />
            </div>
            <ExtractedFieldInput label="Definition" field={item.definition} onUpdate={(v) => updateItem({ ...item, definition: v })} onViewSource={onViewSource} isReadOnly={isReadOnly} />
            <div className="grid grid-cols-2 gap-2">
              <ExtractedFieldInput label="Events N" field={item.eventsN} type="number" onUpdate={(v) => updateItem({ ...item, eventsN: v })} onViewSource={onViewSource} isReadOnly={isReadOnly} />
              <ExtractedFieldInput label="Total N" field={item.totalN} type="number" onUpdate={(v) => updateItem({ ...item, totalN: v })} onViewSource={onViewSource} isReadOnly={isReadOnly} />
            </div>
            <ExtractedFieldInput label="Notes" field={item.notes} type="textarea" onUpdate={(v) => updateItem({ ...item, notes: v })} onViewSource={onViewSource} isReadOnly={isReadOnly} />
          </div>
        )}
      />
    </div>
  );
}

function ComplicationsStep({ data, onUpdate, onViewSource, isReadOnly }: any) {
  const complications = data as Complications | undefined;
  return (
    <div className="space-y-4">
      <ArrayFieldSection
        label="Complication Items"
        items={complications?.items || []}
        onUpdate={(items) => onUpdate('items', items)}
        onViewSource={onViewSource}
        isReadOnly={isReadOnly}
        renderItem={(item: any, idx, updateItem) => (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <ExtractedFieldInput label="Arm ID" field={item.armId} onUpdate={(v) => updateItem({ ...item, armId: v })} onViewSource={onViewSource} isReadOnly={isReadOnly} />
              <ExtractedFieldInput label="Complication" field={item.complication} onUpdate={(v) => updateItem({ ...item, complication: v })} onViewSource={onViewSource} isReadOnly={isReadOnly} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <ExtractedFieldInput label="Events N" field={item.eventsN} type="number" onUpdate={(v) => updateItem({ ...item, eventsN: v })} onViewSource={onViewSource} isReadOnly={isReadOnly} />
              <ExtractedFieldInput label="Total N" field={item.totalN} type="number" onUpdate={(v) => updateItem({ ...item, totalN: v })} onViewSource={onViewSource} isReadOnly={isReadOnly} />
              <ExtractedFieldInput label="Timepoint" field={item.timepoint} onUpdate={(v) => updateItem({ ...item, timepoint: v })} onViewSource={onViewSource} isReadOnly={isReadOnly} />
            </div>
            <ExtractedFieldInput label="Notes" field={item.notes} type="textarea" onUpdate={(v) => updateItem({ ...item, notes: v })} onViewSource={onViewSource} isReadOnly={isReadOnly} />
          </div>
        )}
      />
      
      <ExtractedFieldInput label="Predictors Summary" field={complications?.predictorsSummary} type="textarea" onUpdate={(v) => onUpdate('predictorsSummary', v)} onViewSource={onViewSource} isReadOnly={isReadOnly} />
      
      <ArrayFieldSection
        label="Predictor Analyses"
        items={complications?.predictorAnalyses || []}
        onUpdate={(items) => onUpdate('predictorAnalyses', items)}
        onViewSource={onViewSource}
        isReadOnly={isReadOnly}
        renderItem={(item: any, idx, updateItem) => (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <ExtractedFieldInput label="Predictor" field={item.predictor} onUpdate={(v) => updateItem({ ...item, predictor: v })} onViewSource={onViewSource} isReadOnly={isReadOnly} />
              <ExtractedFieldInput label="Effect Measure" field={item.effectMeasure} onUpdate={(v) => updateItem({ ...item, effectMeasure: v })} onViewSource={onViewSource} isReadOnly={isReadOnly} />
            </div>
            <div className="grid grid-cols-4 gap-2">
              <ExtractedFieldInput label="Estimate" field={item.estimate} type="number" onUpdate={(v) => updateItem({ ...item, estimate: v })} onViewSource={onViewSource} isReadOnly={isReadOnly} />
              <ExtractedFieldInput label="CI Lower" field={item.ciLower} type="number" onUpdate={(v) => updateItem({ ...item, ciLower: v })} onViewSource={onViewSource} isReadOnly={isReadOnly} />
              <ExtractedFieldInput label="CI Upper" field={item.ciUpper} type="number" onUpdate={(v) => updateItem({ ...item, ciUpper: v })} onViewSource={onViewSource} isReadOnly={isReadOnly} />
              <ExtractedFieldInput label="P-Value" field={item.pValue} type="number" onUpdate={(v) => updateItem({ ...item, pValue: v })} onViewSource={onViewSource} isReadOnly={isReadOnly} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <ExtractedFieldInput label="Adjusted" field={item.adjusted} type="boolean" onUpdate={(v) => updateItem({ ...item, adjusted: v })} onViewSource={onViewSource} isReadOnly={isReadOnly} />
              <ExtractedFieldInput label="Model Notes" field={item.modelNotes} onUpdate={(v) => updateItem({ ...item, modelNotes: v })} onViewSource={onViewSource} isReadOnly={isReadOnly} />
            </div>
          </div>
        )}
      />
    </div>
  );
}

// Array field section component
interface ArrayFieldSectionProps<T> {
  label: string;
  items: T[];
  onUpdate: (items: T[]) => void;
  onViewSource: (page: number, exactText: string) => void;
  isReadOnly: boolean;
  renderItem: (item: T, index: number, updateItem: (item: T) => void) => React.ReactNode;
}

function ArrayFieldSection<T>({ label, items, onUpdate, onViewSource, isReadOnly, renderItem }: ArrayFieldSectionProps<T>) {
  const addItem = () => {
    onUpdate([...items, { confidence: 'medium', source_location: { page: 1 } } as T]);
  };

  const removeItem = (index: number) => {
    onUpdate(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, item: T) => {
    const newItems = [...items];
    newItems[index] = item;
    onUpdate(newItems);
  };

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between mb-3">
          <Label className="text-sm font-semibold text-slate-700">{label}</Label>
          {!isReadOnly && (
            <Button variant="outline" size="sm" onClick={addItem}>
              <Plus className="h-3 w-3 mr-1" />
              Add
            </Button>
          )}
        </div>
        {items.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">No items added yet</p>
        ) : (
          <div className="space-y-3">
            {items.map((item, idx) => (
              <div key={idx} className="bg-slate-50 rounded-lg border p-3 relative">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="secondary" className="text-xs">Item {idx + 1}</Badge>
                  {!isReadOnly && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-slate-400 hover:text-red-500"
                      onClick={() => removeItem(idx)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                {renderItem(item, idx, (updated) => updateItem(idx, updated))}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Utility functions
function countFieldsInObject(obj: any): { filled: number; total: number } {
  if (!obj || typeof obj !== 'object') return { filled: 0, total: 0 };
  
  let filled = 0;
  let total = 0;

  for (const key of Object.keys(obj)) {
    const value = obj[key];
    
    if (Array.isArray(value)) {
      // Count array items
      total += Math.max(1, value.length);
      filled += value.filter(v => v && Object.keys(v).length > 0).length;
    } else if (value && typeof value === 'object') {
      if ('content' in value) {
        // This is an ExtractedField
        total += 1;
        if (value.content !== undefined && value.content !== '' && value.content !== null) {
          filled += 1;
        }
      } else {
        // Nested object - recurse
        const nested = countFieldsInObject(value);
        filled += nested.filled;
        total += nested.total;
      }
    }
  }

  return { filled, total };
}
