import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { useMutation } from "convex/react";
import { getConvexApi } from "@/lib/convex-api";
import { useAuth } from "@/hooks/use-auth";

interface AllocateColdCallerDialogProps {
  availableLeads: number;
  onAllocate: (leadsPerStaff: number) => Promise<void>;
  isAllocating: boolean;
}

export function AllocateColdCallerDialog({
  availableLeads,
  onAllocate,
  isAllocating,
}: AllocateColdCallerDialogProps) {
  const [open, setOpen] = useState(false);
  const [leadsPerStaff, setLeadsPerStaff] = useState<string>("10");
  const { user } = useAuth();
  const api = getConvexApi() as any;
  const unassignLeads = useMutation(api.coldCallerLeads.unassignColdCallerLeadsWithoutFollowUp);
  const [isUnassigning, setIsUnassigning] = useState(false);

  const handleAllocate = async () => {
    const num = parseInt(leadsPerStaff);
    if (isNaN(num) || num <= 0) {
      toast.error("Please enter a valid number");
      return;
    }

    try {
      await onAllocate(num);
      setOpen(false);
      setLeadsPerStaff("10");
    } catch (error) {
      // Error handled by parent
    }
  };

  const handleUnassign = async () => {
    if (!user) return;
    setIsUnassigning(true);
    try {
      const count = await unassignLeads({ adminId: user._id });
      toast.success(`Successfully unassigned ${count} leads without follow-up`);
      setOpen(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to unassign leads");
    } finally {
      setIsUnassigning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Users className="mr-2 h-4 w-4" />
          Manage Cold Caller Leads
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Manage Cold Caller Leads</DialogTitle>
          <DialogDescription>
            Allocate cold caller leads to all staff members. Available leads: <strong>{availableLeads}</strong>
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="leadsPerStaff" className="text-right">
              Leads per Staff
            </Label>
            <Input
              id="leadsPerStaff"
              type="number"
              min="1"
              value={leadsPerStaff}
              onChange={(e) => setLeadsPerStaff(e.target.value)}
              className="col-span-3"
              placeholder="Enter number of leads"
            />
          </div>
          <div className="text-sm text-muted-foreground">
            {availableLeads > 0 ? (
              <p>
                If the requested amount exceeds available leads, they will be distributed equally among staff members.
              </p>
            ) : (
              <p className="text-destructive">
                No unallocated cold caller leads available. Please mark leads as cold caller leads first.
              </p>
            )}
          </div>
          
          <div className="border-t pt-4 mt-2">
            <h4 className="text-sm font-medium mb-2">Cleanup Actions</h4>
            <Button 
              variant="secondary" 
              className="w-full" 
              onClick={handleUnassign}
              disabled={isUnassigning}
            >
              <UserMinus className="mr-2 h-4 w-4" />
              {isUnassigning ? "Unassigning..." : "Unassign Leads Without Follow-up"}
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              This will remove assignment from cold caller leads that haven't been given a follow-up date, returning them to the available pool.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isAllocating || isUnassigning}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            onClick={handleAllocate}
            disabled={isAllocating || availableLeads === 0 || isUnassigning}
          >
            {isAllocating ? "Allocating..." : "Allocate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
