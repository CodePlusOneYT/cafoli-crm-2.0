import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Doc, Id } from "@/convex/_generated/dataModel";

interface OverdueLeadsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leads: Doc<"leads">[] | undefined;
  onSelectLead: (id: Id<"leads">) => void;
}

export function OverdueLeadsDialog({ open, onOpenChange, leads, onSelectLead }: OverdueLeadsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-red-600 flex items-center gap-2">
            ⚠️ Overdue Follow-ups ({leads?.length || 0})
          </DialogTitle>
          <DialogDescription>
            You have the following leads with overdue follow-ups. Please take action.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 mt-4">
          {leads?.map((lead) => (
            <div 
              key={lead._id} 
              className="p-3 border border-red-200 bg-red-50 rounded-lg flex justify-between items-center cursor-pointer hover:bg-red-100 transition-colors"
              onClick={() => {
                onSelectLead(lead._id);
                onOpenChange(false);
              }}
            >
              <div>
                <h4 className="font-semibold text-red-900">{lead.name}</h4>
                <p className="text-sm text-red-700">{lead.subject}</p>
              </div>
              <div className="text-right">
                <div className="text-xs font-bold text-red-600">
                  {lead.nextFollowUpDate ? new Date(lead.nextFollowUpDate).toLocaleString() : "Unknown"}
                </div>
                <div className="text-xs text-red-500">Click to view</div>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
