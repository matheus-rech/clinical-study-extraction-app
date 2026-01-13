import { useState, useEffect } from 'react';
import { Plus, Trash2, GripVertical, Sparkles, Loader2, Wand2, Code, List, BookOpen, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import type { ExtractionSchema, ExtractionField, SchemaTemplate, StudyType } from '../../../drizzle/schema';

type EditorMode = 'templates' | 'visual' | 'json' | 'prompt';

const STUDY_TYPE_LABELS: Record<StudyType, string> = {
  rct: 'RCT',
  cohort: 'Cohort',
  case_control: 'Case-Control',
  cross_sectional: 'Cross-Sectional',
  meta_analysis: 'Meta-Analysis',
  systematic_review: 'Systematic Review',
  case_report: 'Case Report',
  qualitative: 'Qualitative',
  other: 'Other',
};

const STUDY_TYPE_COLORS: Record<StudyType, string> = {
  rct: 'bg-purple-100 text-purple-700',
  cohort: 'bg-blue-100 text-blue-700',
  case_control: 'bg-green-100 text-green-700',
  cross_sectional: 'bg-amber-100 text-amber-700',
  meta_analysis: 'bg-indigo-100 text-indigo-700',
  systematic_review: 'bg-cyan-100 text-cyan-700',
  case_report: 'bg-rose-100 text-rose-700',
  qualitative: 'bg-teal-100 text-teal-700',
  other: 'bg-slate-100 text-slate-700',
};

interface SchemaEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schema: ExtractionSchema;
  onSave: (schema: ExtractionSchema) => void;
  documentContext?: string;
}

export function SchemaEditor({ open, onOpenChange, schema, onSave, documentContext }: SchemaEditorProps) {
  const [fields, setFields] = useState<ExtractionField[]>(schema.fields);
  const [mode, setMode] = useState<EditorMode>('templates');
  const [jsonValue, setJsonValue] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  
  // AI Prompt state
  const [prompt, setPrompt] = useState('');
  const [aiReasoning, setAiReasoning] = useState<string | null>(null);
  const [generatedSchema, setGeneratedSchema] = useState<ExtractionSchema | null>(null);

  // Template state
  const [selectedTemplate, setSelectedTemplate] = useState<SchemaTemplate | null>(null);

  const { data: templates, isLoading: templatesLoading } = trpc.templates.list.useQuery();
  const generateSchemaMutation = trpc.schemas.generateFromPrompt.useMutation();

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setFields(schema.fields);
      setMode('templates');
      setSelectedTemplate(null);
      setGeneratedSchema(null);
      setAiReasoning(null);
      setPrompt('');
    }
  }, [open, schema.fields]);

  const handleAddField = () => {
    setFields([
      ...fields,
      {
        name: `field_${fields.length + 1}`,
        label: `Field ${fields.length + 1}`,
        type: 'text',
        description: '',
      },
    ]);
  };

  const handleRemoveField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const handleUpdateField = (index: number, updates: Partial<ExtractionField>) => {
    setFields(
      fields.map((field, i) => (i === index ? { ...field, ...updates } : field))
    );
  };

  const handleSave = () => {
    if (mode === 'json') {
      try {
        const parsed = JSON.parse(jsonValue);
        if (!parsed.fields || !Array.isArray(parsed.fields)) {
          setJsonError('Schema must have a "fields" array');
          return;
        }
        onSave(parsed);
      } catch (e) {
        setJsonError('Invalid JSON format');
        return;
      }
    } else if (mode === 'templates' && selectedTemplate) {
      onSave(selectedTemplate.schema);
    } else if (mode === 'prompt' && generatedSchema) {
      onSave(generatedSchema);
    } else {
      onSave({ fields });
    }
    onOpenChange(false);
  };

  const handleSwitchMode = (newMode: EditorMode) => {
    // Save current state before switching
    if (mode === 'json') {
      try {
        const parsed = JSON.parse(jsonValue);
        if (parsed.fields && Array.isArray(parsed.fields)) {
          setFields(parsed.fields);
        }
      } catch (e) {
        // Keep existing fields if JSON is invalid
      }
    } else if (mode === 'prompt' && generatedSchema) {
      setFields(generatedSchema.fields);
    } else if (mode === 'templates' && selectedTemplate) {
      setFields(selectedTemplate.schema.fields);
    }

    // Prepare new mode state
    if (newMode === 'json') {
      setJsonValue(JSON.stringify({ fields }, null, 2));
      setJsonError(null);
    }

    setMode(newMode);
  };

  const handleGenerateSchema = async () => {
    if (!prompt.trim()) {
      toast.error('Please describe what you want to extract');
      return;
    }

    try {
      const result = await generateSchemaMutation.mutateAsync({
        prompt: prompt.trim(),
        documentContext: documentContext?.substring(0, 5000),
      });

      if (result.success && result.schema) {
        setGeneratedSchema(result.schema);
        setAiReasoning(result.reasoning || null);
        toast.success('Schema generated successfully!');
      }
    } catch (error) {
      toast.error('Failed to generate schema. Please try again.');
      console.error('Schema generation error:', error);
    }
  };

  const handleSelectTemplate = (template: SchemaTemplate) => {
    setSelectedTemplate(template);
    setFields(template.schema.fields);
  };

  const handleUseGeneratedSchema = () => {
    if (generatedSchema) {
      setFields(generatedSchema.fields);
      setMode('visual');
      setGeneratedSchema(null);
      setAiReasoning(null);
    }
  };

  const builtInTemplates = templates?.filter(t => t.isBuiltIn) || [];
  const userTemplates = templates?.filter(t => !t.isBuiltIn) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Configure Extraction Schema</DialogTitle>
          <DialogDescription>
            Choose a template or create a custom schema for data extraction.
          </DialogDescription>
        </DialogHeader>

        {/* Mode Tabs */}
        <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
          <Button
            variant={mode === 'templates' ? 'default' : 'ghost'}
            size="sm"
            className="flex-1"
            onClick={() => handleSwitchMode('templates')}
          >
            <BookOpen className="h-4 w-4 mr-2" />
            Templates
          </Button>
          <Button
            variant={mode === 'prompt' ? 'default' : 'ghost'}
            size="sm"
            className="flex-1"
            onClick={() => handleSwitchMode('prompt')}
          >
            <Wand2 className="h-4 w-4 mr-2" />
            AI Generate
          </Button>
          <Button
            variant={mode === 'visual' ? 'default' : 'ghost'}
            size="sm"
            className="flex-1"
            onClick={() => handleSwitchMode('visual')}
          >
            <List className="h-4 w-4 mr-2" />
            Visual
          </Button>
          <Button
            variant={mode === 'json' ? 'default' : 'ghost'}
            size="sm"
            className="flex-1"
            onClick={() => handleSwitchMode('json')}
          >
            <Code className="h-4 w-4 mr-2" />
            JSON
          </Button>
        </div>

        <ScrollArea className="flex-1 mt-4">
          {/* Templates Mode */}
          {mode === 'templates' && (
            <div className="space-y-4 pr-4">
              {templatesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                </div>
              ) : (
                <>
                  {/* Built-in Templates */}
                  {builtInTemplates.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-slate-500 mb-2 flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        Built-in Templates
                      </h3>
                      <div className="space-y-2">
                        {builtInTemplates.map((template) => (
                          <TemplateItem
                            key={template.id}
                            template={template}
                            isSelected={selectedTemplate?.id === template.id}
                            onSelect={() => handleSelectTemplate(template)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* User Templates */}
                  {userTemplates.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-slate-500 mb-2">My Templates</h3>
                      <div className="space-y-2">
                        {userTemplates.map((template) => (
                          <TemplateItem
                            key={template.id}
                            template={template}
                            isSelected={selectedTemplate?.id === template.id}
                            onSelect={() => handleSelectTemplate(template)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Selected Template Preview */}
                  {selectedTemplate && (
                    <div className="border-t pt-4 mt-4">
                      <h3 className="text-sm font-medium text-slate-900 mb-2">
                        Selected: {selectedTemplate.name}
                      </h3>
                      <p className="text-sm text-slate-500 mb-3">
                        {selectedTemplate.description || 'No description'}
                      </p>
                      <div className="bg-slate-50 rounded-lg p-3 max-h-[200px] overflow-y-auto">
                        <p className="text-xs text-slate-500 mb-2">
                          {selectedTemplate.schema.fields.length} extraction fields:
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {selectedTemplate.schema.fields.map((field, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {field.label}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {templates?.length === 0 && (
                    <div className="text-center py-8">
                      <BookOpen className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-500">No templates available yet</p>
                      <p className="text-sm text-slate-400 mt-1">
                        Use AI Generate or Visual Editor to create a schema
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* AI Prompt Mode */}
          {mode === 'prompt' && (
            <div className="space-y-4 pr-4">
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="bg-purple-100 p-2 rounded-lg">
                    <Sparkles className="h-5 w-5 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-slate-900 mb-1">
                      Describe what you want to extract
                    </h3>
                    <p className="text-sm text-slate-600 mb-3">
                      Tell the AI agent what data you need. It will design the optimal extraction schema for your documents.
                    </p>
                    <Textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="Example: I need to extract clinical trial information including the study registration number, total number of participants, primary and secondary outcomes, intervention details, and any adverse events reported..."
                      className="min-h-[120px] bg-white"
                    />
                    <Button
                      className="mt-3 bg-purple-600 hover:bg-purple-700"
                      onClick={handleGenerateSchema}
                      disabled={generateSchemaMutation.isPending || !prompt.trim()}
                    >
                      {generateSchemaMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Generating Schema...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                          Generate Schema
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Generated Schema Preview */}
              {generatedSchema && (
                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-slate-900">Generated Schema</h4>
                    <Button size="sm" onClick={handleUseGeneratedSchema}>
                      Edit in Visual Editor
                    </Button>
                  </div>

                  {aiReasoning && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                      <strong>AI Reasoning:</strong> {aiReasoning}
                    </div>
                  )}

                  <div className="space-y-2">
                    {generatedSchema.fields.map((field, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-3 p-2 bg-slate-50 rounded border"
                      >
                        <div className="flex-1">
                          <span className="font-medium text-sm">{field.label}</span>
                          <span className="text-xs text-slate-500 ml-2">({field.type})</span>
                          {field.description && (
                            <p className="text-xs text-slate-500 mt-0.5">{field.description}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Examples */}
              <div className="border-t pt-4">
                <p className="text-xs text-slate-500 mb-2">Quick examples:</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    'Extract study ID, sample size, and primary outcomes from clinical trials',
                    'Get author names, publication year, methodology, and key findings',
                    'Extract drug names, dosages, adverse events, and efficacy measures',
                  ].map((example, i) => (
                    <button
                      key={i}
                      onClick={() => setPrompt(example)}
                      className="text-xs px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-slate-600 transition-colors"
                    >
                      {example.substring(0, 50)}...
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* JSON Mode */}
          {mode === 'json' && (
            <div className="space-y-2 pr-4">
              <Textarea
                value={jsonValue}
                onChange={(e) => {
                  setJsonValue(e.target.value);
                  setJsonError(null);
                }}
                className="font-mono text-sm min-h-[300px]"
                placeholder='{"fields": [...]}'
              />
              {jsonError && (
                <p className="text-sm text-red-500">{jsonError}</p>
              )}
            </div>
          )}

          {/* Visual Mode */}
          {mode === 'visual' && (
            <div className="space-y-3 pr-4">
              {fields.map((field, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-3 border rounded-lg bg-slate-50"
                >
                  <div className="pt-2 text-slate-400 cursor-move">
                    <GripVertical className="h-4 w-4" />
                  </div>
                  <div className="flex-1 grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Field Name (ID)</Label>
                      <Input
                        value={field.name}
                        onChange={(e) =>
                          handleUpdateField(index, {
                            name: e.target.value.toLowerCase().replace(/\s+/g, '_'),
                          })
                        }
                        placeholder="field_name"
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Display Label</Label>
                      <Input
                        value={field.label}
                        onChange={(e) =>
                          handleUpdateField(index, { label: e.target.value })
                        }
                        placeholder="Field Label"
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Field Type</Label>
                      <Select
                        value={field.type}
                        onValueChange={(value: 'text' | 'textarea' | 'number' | 'integer' | 'boolean') =>
                          handleUpdateField(index, { type: value })
                        }
                      >
                        <SelectTrigger className="text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Text</SelectItem>
                          <SelectItem value="textarea">Long Text</SelectItem>
                          <SelectItem value="number">Number</SelectItem>
                          <SelectItem value="integer">Integer</SelectItem>
                          <SelectItem value="boolean">Boolean</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Description (for AI)</Label>
                      <Input
                        value={field.description || ''}
                        onChange={(e) =>
                          handleUpdateField(index, { description: e.target.value })
                        }
                        placeholder="What to extract..."
                        className="text-sm"
                      />
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-slate-400 hover:text-red-500"
                    onClick={() => handleRemoveField(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              <Button
                variant="outline"
                className="w-full"
                onClick={handleAddField}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Field
              </Button>
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={
              (mode === 'templates' && !selectedTemplate) ||
              (mode === 'prompt' && !generatedSchema && fields.length === 0) ||
              (mode === 'visual' && fields.length === 0)
            }
          >
            {mode === 'templates' && selectedTemplate 
              ? 'Use Template' 
              : mode === 'prompt' && generatedSchema 
                ? 'Use Generated Schema' 
                : 'Save Schema'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface TemplateItemProps {
  template: SchemaTemplate;
  isSelected: boolean;
  onSelect: () => void;
}

function TemplateItem({ template, isSelected, onSelect }: TemplateItemProps) {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-3 rounded-lg border transition-all ${
        isSelected 
          ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' 
          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm text-slate-900">{template.name}</span>
              {template.isBuiltIn && (
                <Badge variant="secondary" className="text-xs">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Built-in
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={`text-xs ${STUDY_TYPE_COLORS[template.studyType]}`}>
                {STUDY_TYPE_LABELS[template.studyType]}
              </Badge>
              <span className="text-xs text-slate-500">
                {template.schema.fields.length} fields
              </span>
            </div>
          </div>
        </div>
        <ChevronRight className={`h-4 w-4 transition-transform ${isSelected ? 'text-blue-500 rotate-90' : 'text-slate-400'}`} />
      </div>
      {template.description && (
        <p className="text-xs text-slate-500 mt-2 line-clamp-2">{template.description}</p>
      )}
    </button>
  );
}
