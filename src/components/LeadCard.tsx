import { Card, CardContent } from "@/components/ui/card";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { LeadCardHeader } from "@/components/leads/LeadCardHeader";
import { LeadCardTags } from "@/components/leads/LeadCardTags";
import { LeadCardBadges } from "@/components/leads/LeadCardBadges";
import { LeadCardActions } from "@/components/leads/LeadCardActions";

interface LeadCardProps {
  lead: Doc<"leads"> & { 
    tagsData?: Doc<"tags">[]; 
    unreadCount?: number;
    assignedToName?: string;
    coldCallerAssignedToName?: string;
  };
  isSelected: boolean;
  isUnassignedView: boolean;
  viewIrrelevant: boolean;
  isAdmin: boolean;
  allUsers: Doc<"users">[];
  onSelect: (id: Id<"leads">) => void;
  onAssignToSelf: (id: Id<"leads">) => void;
  onAssignToUser: (leadId: Id<"leads">, userId: Id<"users">) => void;
  onUnassign?: (leadId: Id<"leads">) => void;
  onOpenWhatsApp?: (leadId: Id<"leads">) => void;
}

export function LeadCard({
  lead,
  isSelected,
  isUnassignedView,
  viewIrrelevant,
  isAdmin,
  allUsers,
  onSelect,
  onAssignToSelf,
  onAssignToUser,
  onUnassign,
  onOpenWhatsApp,
}: LeadCardProps) {
  const hasUnreadMessages = (lead.unreadCount ?? 0) > 0;
  
  return (
    <Card
      className={`cursor-pointer transition-colors hover:bg-accent/50 ${
        isSelected ? "border-primary bg-accent/50" : ""
      } ${
        lead.nextFollowUpDate && lead.nextFollowUpDate < Date.now() ? "border-red-300 bg-red-50/50" : ""
      } ${
        hasUnreadMessages ? "border-green-500 bg-green-0/30 shadow-lg" : ""
      }`}
      onClick={() => onSelect(lead._id)}
    >
      <CardContent className="p-4">
        <LeadCardHeader
          name={lead.name}
          creationTime={lead._creationTime}
          hasUnreadMessages={hasUnreadMessages}
          unreadCount={lead.unreadCount}
        />
        
        <p className="text-sm text-muted-foreground truncate mb-2">{lead.subject}</p>
        
        <LeadCardTags tags={lead.tagsData || []} />

        <div className="flex gap-2 text-xs flex-wrap items-center">
          <LeadCardBadges lead={lead} />
          
          <LeadCardActions
            lead={lead}
            isUnassignedView={isUnassignedView}
            viewIrrelevant={viewIrrelevant}
            isAdmin={isAdmin}
            allUsers={allUsers}
            hasUnreadMessages={hasUnreadMessages}
            onAssignToSelf={onAssignToSelf}
            onAssignToUser={onAssignToUser}
            onUnassign={onUnassign}
            onOpenWhatsApp={onOpenWhatsApp}
          />
        </div>
      </CardContent>
    </Card>
  );
}