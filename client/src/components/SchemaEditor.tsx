import { useState } from 'react';
import { Plus, Trash2, GripVertical, Sparkles, Loader2, Wand2, Code, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import type { ExtractionSchema, ExtractionField } from '../../../drizzle/schema';

type EditorMode = 'visual' | 'json' | 'prompt';

interface SchemaEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schema: ExtractionSchema;
  onSave: (schema: ExtractionSchema) => void;
  documentContext?: string; // Optional document text for better AI schema generation
}

export function SchemaEditor({ open, onOpenChange, schema, onSave, documentContext }: SchemaEditorProps) {
  const [fields, setFields] = useState<ExtractionField[]>(schema.fields);
  const [mode, setMode] = useState<EditorMode>('prompt');
  const [jsonValue, setJsonValue] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  
  // AI Prompt state
  const [prompt, setPrompt] = useState('');
  const [aiReasoning, setAiReasoning] = useState<string | null>(null);
  const [generatedSchema, setGeneratedSchema] = useState<ExtractionSchema | null>(null);

  const generateSchemaMutation = trpc.schemas.generateFromPrompt.useMutation();

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

  const handleUseGeneratedSchema = () => {
    if (generatedSchema) {
      setFields(generatedSchema.fields);
      setMode('visual');
      setGeneratedSchema(null);
      setAiReasoning(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Configure Extraction Schema</DialogTitle>
          <DialogDescription>
            Define the fields you want the AI to extract from your documents.
          </DialogDescription>
        </DialogHeader>

        {/* Mode Tabs */}
        <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
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
            Visual Editor
          </Button>
          <Button
            variant={mode === 'json' ? 'default' : 'ghost'}
            size="sm"
            className="flex-1"
            onClick={() => handleSwitchMode('json')}
          >
            <Code className="h-4 w-4 mr-2" />
            JSON Editor
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto mt-4">
          {/* AI Prompt Mode */}
          {mode === 'prompt' && (
            <div className="space-y-4">
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
            <div className="space-y-2">
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
            <div className="space-y-3">
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
                        onValueChange={(value: 'text' | 'textarea' | 'number') =>
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
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={mode === 'prompt' && !generatedSchema && fields.length === 0}
          >
            {mode === 'prompt' && generatedSchema ? 'Use Generated Schema' : 'Save Schema'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
