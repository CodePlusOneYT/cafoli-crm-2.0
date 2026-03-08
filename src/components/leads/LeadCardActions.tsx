import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { UserPlus, MessageCircle, UserMinus, Archive } from "lucide-react";
import { toast } from "sonner";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

interface LeadCardActionsProps {
  lead: Doc<"leads">;
  isUnassignedView: boolean;
  viewIrrelevant: boolean;
  isAdmin: boolean;
  allUsers: Doc<"users">[];
  hasUnreadMessages: boolean;
  onAssignToSelf: (id: Id<"leads">) => void;
  onAssignToUser: (leadId: Id<"leads">, userId: Id<"users">) => void;
  onUnassign?: (leadId: Id<"leads">) => void;
  onOpenWhatsApp?: (leadId: Id<"leads">) => void;
}

export function LeadCardActions({
  lead,
  isUnassignedView,
  viewIrrelevant,
  isAdmin,
  allUsers,
  hasUnreadMessages,
  onAssignToSelf,
  onAssignToUser,
  onUnassign,
  onOpenWhatsApp,
}: LeadCardActionsProps) {
  const offloadSingleToR2 = useMutation(api.r2_cache_prototype.offloadSingleToR2);

  const handleOffload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await offloadSingleToR2({ leadId: lead._id });
      toast.success("Lead archived to R2 storage");
    } catch (error: any) {
      toast.error(error.message || "Failed to archive lead");
    }
  };

  return (
    <>
      {isAdmin && (
        <Button
          size="sm"
          variant="outline"
          className="h-6 text-xs text-orange-600 hover:text-orange-700 hover:bg-orange-50 border-orange-200"
          onClick={handleOffload}
          title="Archive to R2 Storage"
        >
          <Archive className="h-3 w-3 mr-1" />
          Archive
        </Button>
      )}

      {onOpenWhatsApp && (
        <Button
          size="sm"
          variant={hasUnreadMessages ? "default" : "outline"}
          className={`h-6 text-xs ${hasUnreadMessages ? 'bg-green-600 hover:bg-green-700 animate-pulse' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onOpenWhatsApp(lead._id);
          }}
        >
          <MessageCircle className="h-3 w-3 mr-1" />
          WhatsApp
        </Button>
      )}
      
      {onUnassign && lead.assignedTo && (
        <Button
          size="sm"
          variant="outline"
          className="h-6 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
          onClick={(e) => {
            e.stopPropagation();
            onUnassign(lead._id);
          }}
        >
          <UserMinus className="h-3 w-3 mr-1" />
          Unassign
        </Button>
      )}

      {isUnassignedView && !lead.assignedTo && !viewIrrelevant && (
        <>
          {!isAdmin ? (
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-xs"
              disabled={lead.adminAssignmentRequired}
              onClick={(e) => {
                e.stopPropagation();
                if (lead.adminAssignmentRequired) {
                  toast.error("This lead can only be assigned by an admin");
                  return;
                }
                onAssignToSelf(lead._id);
              }}
            >
              <UserPlus className="h-3 w-3 mr-1" />
              Assign to me
            </Button>
          ) : (
            <Select
              onValueChange={(userId) => {
                onAssignToUser(lead._id, userId as Id<"users">);
              }}
            >
              <SelectTrigger 
                className="h-6 text-xs w-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <SelectValue placeholder="Assign to..." />
              </SelectTrigger>
              <SelectContent>
                {allUsers.map((u) => (
                  <SelectItem key={u._id} value={u._id}>
                    {u.name || u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </>
      )}
    </>
  );
}