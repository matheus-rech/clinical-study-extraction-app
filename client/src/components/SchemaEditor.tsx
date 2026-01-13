import { useState } from 'react';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import type { ExtractionSchema, ExtractionField } from '../../../drizzle/schema';

interface SchemaEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schema: ExtractionSchema;
  onSave: (schema: ExtractionSchema) => void;
}

export function SchemaEditor({ open, onOpenChange, schema, onSave }: SchemaEditorProps) {
  const [fields, setFields] = useState<ExtractionField[]>(schema.fields);
  const [jsonMode, setJsonMode] = useState(false);
  const [jsonValue, setJsonValue] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);

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
    if (jsonMode) {
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
    } else {
      onSave({ fields });
    }
    onOpenChange(false);
  };

  const handleSwitchToJson = () => {
    setJsonValue(JSON.stringify({ fields }, null, 2));
    setJsonError(null);
    setJsonMode(true);
  };

  const handleSwitchToVisual = () => {
    try {
      const parsed = JSON.parse(jsonValue);
      if (parsed.fields && Array.isArray(parsed.fields)) {
        setFields(parsed.fields);
      }
    } catch (e) {
      // Keep existing fields if JSON is invalid
    }
    setJsonMode(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Configure Extraction Schema</DialogTitle>
          <DialogDescription>
            Define the fields you want the AI to extract from your documents.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 mb-4">
          <Button
            variant={jsonMode ? 'outline' : 'default'}
            size="sm"
            onClick={() => !jsonMode || handleSwitchToVisual()}
          >
            Visual Editor
          </Button>
          <Button
            variant={jsonMode ? 'default' : 'outline'}
            size="sm"
            onClick={() => jsonMode || handleSwitchToJson()}
          >
            JSON Editor
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {jsonMode ? (
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
          ) : (
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
          <Button onClick={handleSave}>Save Schema</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
