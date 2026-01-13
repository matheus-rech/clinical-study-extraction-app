import { useState } from 'react';
import { Link } from 'wouter';
import { 
  Plus, FileText, Trash2, Edit2, Copy, ChevronLeft, 
  Search, Filter, MoreVertical, Sparkles, BookOpen,
  FlaskConical, Users, BarChart3, FileSearch, Microscope
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import type { ExtractionSchema, SchemaTemplate, StudyType } from '../../../drizzle/schema';

const STUDY_TYPE_ICONS: Record<StudyType, React.ReactNode> = {
  rct: <FlaskConical className="h-4 w-4" />,
  cohort: <Users className="h-4 w-4" />,
  case_control: <BarChart3 className="h-4 w-4" />,
  cross_sectional: <FileSearch className="h-4 w-4" />,
  meta_analysis: <BookOpen className="h-4 w-4" />,
  systematic_review: <FileSearch className="h-4 w-4" />,
  case_report: <FileText className="h-4 w-4" />,
  qualitative: <Microscope className="h-4 w-4" />,
  other: <FileText className="h-4 w-4" />,
};

const STUDY_TYPE_LABELS: Record<StudyType, string> = {
  rct: 'Randomized Controlled Trial',
  cohort: 'Cohort Study',
  case_control: 'Case-Control Study',
  cross_sectional: 'Cross-Sectional Study',
  meta_analysis: 'Meta-Analysis',
  systematic_review: 'Systematic Review',
  case_report: 'Case Report/Series',
  qualitative: 'Qualitative Study',
  other: 'Other',
};

const STUDY_TYPE_COLORS: Record<StudyType, string> = {
  rct: 'bg-purple-100 text-purple-700 border-purple-200',
  cohort: 'bg-blue-100 text-blue-700 border-blue-200',
  case_control: 'bg-green-100 text-green-700 border-green-200',
  cross_sectional: 'bg-amber-100 text-amber-700 border-amber-200',
  meta_analysis: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  systematic_review: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  case_report: 'bg-rose-100 text-rose-700 border-rose-200',
  qualitative: 'bg-teal-100 text-teal-700 border-teal-200',
  other: 'bg-slate-100 text-slate-700 border-slate-200',
};

export default function Templates() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStudyType, setFilterStudyType] = useState<StudyType | 'all'>('all');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SchemaTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<SchemaTemplate | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formStudyType, setFormStudyType] = useState<StudyType>('other');
  const [formSchema, setFormSchema] = useState('');
  const [formIsPublic, setFormIsPublic] = useState(false);

  const utils = trpc.useUtils();
  const { data: templates, isLoading } = trpc.templates.list.useQuery();
  const createMutation = trpc.templates.create.useMutation({
    onSuccess: () => {
      utils.templates.list.invalidate();
      toast.success('Template created successfully');
      resetForm();
      setCreateDialogOpen(false);
    },
    onError: (error) => toast.error(error.message),
  });
  const updateMutation = trpc.templates.update.useMutation({
    onSuccess: () => {
      utils.templates.list.invalidate();
      toast.success('Template updated successfully');
      resetForm();
      setEditingTemplate(null);
    },
    onError: (error) => toast.error(error.message),
  });
  const deleteMutation = trpc.templates.delete.useMutation({
    onSuccess: () => {
      utils.templates.list.invalidate();
      toast.success('Template deleted');
      setDeleteConfirmId(null);
    },
    onError: (error) => toast.error(error.message),
  });

  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormStudyType('other');
    setFormSchema('');
    setFormIsPublic(false);
  };

  const openEditDialog = (template: SchemaTemplate) => {
    setFormName(template.name);
    setFormDescription(template.description || '');
    setFormStudyType(template.studyType);
    setFormSchema(JSON.stringify(template.schema, null, 2));
    setFormIsPublic(template.isPublic);
    setEditingTemplate(template);
  };

  const handleSave = () => {
    let parsedSchema: ExtractionSchema;
    try {
      parsedSchema = JSON.parse(formSchema);
      if (!parsedSchema.fields || !Array.isArray(parsedSchema.fields)) {
        toast.error('Schema must have a "fields" array');
        return;
      }
    } catch (e) {
      toast.error('Invalid JSON schema');
      return;
    }

    if (editingTemplate) {
      updateMutation.mutate({
        id: editingTemplate.id,
        name: formName,
        description: formDescription || undefined,
        studyType: formStudyType,
        schema: parsedSchema,
        isPublic: formIsPublic,
      });
    } else {
      createMutation.mutate({
        name: formName,
        description: formDescription || undefined,
        studyType: formStudyType,
        schema: parsedSchema,
        isPublic: formIsPublic,
      });
    }
  };

  const handleDuplicate = (template: SchemaTemplate) => {
    setFormName(`${template.name} (Copy)`);
    setFormDescription(template.description || '');
    setFormStudyType(template.studyType);
    setFormSchema(JSON.stringify(template.schema, null, 2));
    setFormIsPublic(false);
    setCreateDialogOpen(true);
  };

  // Filter templates
  const filteredTemplates = templates?.filter((t) => {
    const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterStudyType === 'all' || t.studyType === filterStudyType;
    return matchesSearch && matchesType;
  });

  const builtInTemplates = filteredTemplates?.filter(t => t.isBuiltIn) || [];
  const userTemplates = filteredTemplates?.filter(t => !t.isBuiltIn) || [];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/library">
                <Button variant="ghost" size="icon">
                  <ChevronLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-semibold text-slate-900">Extraction Templates</h1>
                <p className="text-sm text-slate-500">Manage reusable extraction schemas for different study types</p>
              </div>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Template
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-6">
        {/* Search and Filter */}
        <div className="flex gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterStudyType} onValueChange={(v) => setFilterStudyType(v as StudyType | 'all')}>
            <SelectTrigger className="w-[200px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Study Types</SelectItem>
              {Object.entries(STUDY_TYPE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  <span className="flex items-center gap-2">
                    {STUDY_TYPE_ICONS[value as StudyType]}
                    {label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : (
          <Tabs defaultValue="all" className="space-y-6">
            <TabsList>
              <TabsTrigger value="all">All Templates ({filteredTemplates?.length || 0})</TabsTrigger>
              <TabsTrigger value="builtin">Built-in ({builtInTemplates.length})</TabsTrigger>
              <TabsTrigger value="custom">My Templates ({userTemplates.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-6">
              {builtInTemplates.length > 0 && (
                <div>
                  <h2 className="text-sm font-medium text-slate-500 mb-3 flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    Built-in Templates
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {builtInTemplates.map((template) => (
                      <TemplateCard
                        key={template.id}
                        template={template}
                        onPreview={() => setPreviewTemplate(template)}
                        onDuplicate={() => handleDuplicate(template)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {userTemplates.length > 0 && (
                <div>
                  <h2 className="text-sm font-medium text-slate-500 mb-3">My Templates</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {userTemplates.map((template) => (
                      <TemplateCard
                        key={template.id}
                        template={template}
                        onPreview={() => setPreviewTemplate(template)}
                        onEdit={() => openEditDialog(template)}
                        onDuplicate={() => handleDuplicate(template)}
                        onDelete={() => setDeleteConfirmId(template.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {filteredTemplates?.length === 0 && (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 mb-2">No templates found</h3>
                  <p className="text-slate-500 mb-4">
                    {searchQuery || filterStudyType !== 'all'
                      ? 'Try adjusting your search or filter'
                      : 'Create your first extraction template to get started'}
                  </p>
                  <Button onClick={() => setCreateDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Template
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="builtin">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {builtInTemplates.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    onPreview={() => setPreviewTemplate(template)}
                    onDuplicate={() => handleDuplicate(template)}
                  />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="custom">
              {userTemplates.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {userTemplates.map((template) => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      onPreview={() => setPreviewTemplate(template)}
                      onEdit={() => openEditDialog(template)}
                      onDuplicate={() => handleDuplicate(template)}
                      onDelete={() => setDeleteConfirmId(template.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 mb-2">No custom templates yet</h3>
                  <p className="text-slate-500 mb-4">
                    Create your own templates or duplicate a built-in one to customize
                  </p>
                  <Button onClick={() => setCreateDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Template
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </main>

      {/* Create/Edit Dialog */}
      <Dialog open={createDialogOpen || !!editingTemplate} onOpenChange={(open) => {
        if (!open) {
          setCreateDialogOpen(false);
          setEditingTemplate(null);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Edit Template' : 'Create New Template'}</DialogTitle>
            <DialogDescription>
              Define a reusable extraction schema for a specific study type
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Template Name</Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., Clinical Trial Extraction"
                />
              </div>

              <div className="col-span-2">
                <Label>Description</Label>
                <Textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Describe what this template is designed to extract..."
                  rows={2}
                />
              </div>

              <div>
                <Label>Study Type</Label>
                <Select value={formStudyType} onValueChange={(v) => setFormStudyType(v as StudyType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STUDY_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        <span className="flex items-center gap-2">
                          {STUDY_TYPE_ICONS[value as StudyType]}
                          {label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsPublic}
                    onChange={(e) => setFormIsPublic(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  <span className="text-sm">Make this template public</span>
                </label>
              </div>

              <div className="col-span-2">
                <Label>Schema (JSON)</Label>
                <Textarea
                  value={formSchema}
                  onChange={(e) => setFormSchema(e.target.value)}
                  placeholder='{"fields": [{"name": "study_id", "label": "Study ID", "type": "text", "description": "..."}]}'
                  className="font-mono text-sm min-h-[200px]"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setCreateDialogOpen(false);
              setEditingTemplate(null);
              resetForm();
            }}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              disabled={!formName || !formSchema || createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewTemplate} onOpenChange={() => setPreviewTemplate(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {previewTemplate && STUDY_TYPE_ICONS[previewTemplate.studyType]}
              {previewTemplate?.name}
            </DialogTitle>
            <DialogDescription>
              {previewTemplate?.description || 'No description provided'}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 py-4">
            {previewTemplate && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge className={STUDY_TYPE_COLORS[previewTemplate.studyType]}>
                    {STUDY_TYPE_LABELS[previewTemplate.studyType]}
                  </Badge>
                  {previewTemplate.isBuiltIn && (
                    <Badge variant="secondary">
                      <Sparkles className="h-3 w-3 mr-1" />
                      Built-in
                    </Badge>
                  )}
                  {previewTemplate.isPublic && (
                    <Badge variant="outline">Public</Badge>
                  )}
                </div>

                <div>
                  <h4 className="text-sm font-medium text-slate-900 mb-2">
                    Extraction Fields ({previewTemplate.schema.fields.length})
                  </h4>
                  <div className="space-y-2">
                    {previewTemplate.schema.fields.map((field, index) => (
                      <div key={index} className="p-3 bg-slate-50 rounded-lg border">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">{field.label}</span>
                          <Badge variant="outline" className="text-xs">
                            {field.type}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">{field.name}</p>
                        {field.description && (
                          <p className="text-sm text-slate-600 mt-2">{field.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewTemplate(null)}>
              Close
            </Button>
            {previewTemplate && (
              <Button onClick={() => {
                handleDuplicate(previewTemplate);
                setPreviewTemplate(null);
              }}>
                <Copy className="h-4 w-4 mr-2" />
                Duplicate & Edit
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteConfirmId !== null} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this template? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => deleteConfirmId && deleteMutation.mutate({ id: deleteConfirmId })}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface TemplateCardProps {
  template: SchemaTemplate;
  onPreview: () => void;
  onEdit?: () => void;
  onDuplicate: () => void;
  onDelete?: () => void;
}

function TemplateCard({ template, onPreview, onEdit, onDuplicate, onDelete }: TemplateCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={onPreview}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${STUDY_TYPE_COLORS[template.studyType].replace('text-', 'bg-').split(' ')[0]}`}>
              {STUDY_TYPE_ICONS[template.studyType]}
            </div>
            <div>
              <CardTitle className="text-base">{template.name}</CardTitle>
              <div className="flex items-center gap-1 mt-1">
                <Badge variant="outline" className="text-xs">
                  {template.schema.fields.length} fields
                </Badge>
                {template.isBuiltIn && (
                  <Badge variant="secondary" className="text-xs">
                    <Sparkles className="h-3 w-3 mr-1" />
                    Built-in
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onPreview(); }}>
                <FileText className="h-4 w-4 mr-2" />
                Preview
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDuplicate(); }}>
                <Copy className="h-4 w-4 mr-2" />
                Duplicate
              </DropdownMenuItem>
              {onEdit && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>
                  <Edit2 className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem 
                  onClick={(e) => { e.stopPropagation(); onDelete(); }}
                  className="text-red-600"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        <CardDescription className="line-clamp-2">
          {template.description || 'No description provided'}
        </CardDescription>
        <div className="mt-3">
          <Badge className={`${STUDY_TYPE_COLORS[template.studyType]} text-xs`}>
            {STUDY_TYPE_LABELS[template.studyType]}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
