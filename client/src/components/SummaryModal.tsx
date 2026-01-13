import { FileSearch, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Streamdown } from 'streamdown';

interface SummaryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary: string | null;
  isLoading: boolean;
}

export function SummaryModal({ open, onOpenChange, summary, isLoading }: SummaryModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader className="bg-gradient-to-r from-orange-50 to-white -m-6 mb-0 p-6 rounded-t-lg border-b">
          <div className="flex items-center gap-2">
            <FileSearch className="h-5 w-5 text-orange-500" />
            <DialogTitle>AI Document Summary</DialogTitle>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-48 gap-4 text-slate-500">
              <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
              <p>Reading document and generating summary...</p>
            </div>
          ) : summary ? (
            <div className="prose prose-slate max-w-none">
              <Streamdown>{summary}</Streamdown>
            </div>
          ) : (
            <p className="text-slate-500 text-center py-8">
              No summary available. Click "Summarize" to generate one.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
