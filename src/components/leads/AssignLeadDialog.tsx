import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AssignLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
  followUpDate: string;
  setFollowUpDate: (date: string) => void;
  minDateTime: string;
  maxDateTime: string;
}

export function AssignLeadDialog({
  open,
  onOpenChange,
  onConfirm,
  onCancel,
  followUpDate,
  setFollowUpDate,
  minDateTime,
  maxDateTime
}: AssignLeadDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set Follow-up Date</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="followUpDate">Follow-up Date & Time</Label>
            <Input
              id="followUpDate"
              type="datetime-local"
              value={followUpDate}
              onChange={(e) => setFollowUpDate(e.target.value)}
              min={minDateTime}
              max={maxDateTime}
              required
            />
            <p className="text-xs text-muted-foreground">
              Must be between now and 31 days in the future
            </p>
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={onCancel}
            >
              Cancel
            </Button>
            <Button onClick={onConfirm}>
              Assign Lead
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
