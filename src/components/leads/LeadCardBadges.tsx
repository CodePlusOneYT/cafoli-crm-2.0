import { Doc } from "@/convex/_generated/dataModel";
import { ThumbsUp, RefreshCw } from "lucide-react";

interface LeadCardBadgesProps {
  lead: Doc<"leads"> & {
    assignedToName?: string;
    coldCallerAssignedToName?: string;
  };
}

export function LeadCardBadges({ lead }: LeadCardBadgesProps) {
  return (
    <div className="flex gap-2 text-xs flex-wrap items-center">
      <span className="bg-secondary px-2 py-0.5 rounded-full">{lead.source}</span>
      
      <span className={`px-2 py-0.5 rounded-full ${
        lead.status === 'Hot' ? 'bg-orange-100 text-orange-700' :
        lead.status === 'Mature' ? 'bg-green-100 text-green-700' :
        lead.status === 'Cold' ? 'bg-blue-100 text-blue-700' :
        'bg-gray-100 text-gray-700'
      }`}>
        {lead.status}
      </span>
      
      {lead.type === 'Relevant' && (
        <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-200">
          <ThumbsUp className="h-3 w-3" />
          Relevant
        </span>
      )}
      
      {lead.adminAssignmentRequired && (
        <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full border border-purple-200">
          Admin Assign Only
        </span>
      )}

      {(lead as any).isRepeatLead && (
        <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full flex items-center gap-1 border border-rose-200 font-medium">
          <RefreshCw className="h-3 w-3" />
          Repeat Lead
          {(lead as any).repeatLeadAt && (
            <span className="text-rose-500 font-normal">
              · {new Date((lead as any).repeatLeadAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
            </span>
          )}
        </span>
      )}

      {(lead as any).isRepeatLead && lead.assignedToName && (
        <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-xs border border-amber-200">
          Assigned to {lead.assignedToName}
        </span>
      )}

      {(lead as any).isRepeatLead && !lead.assignedTo && (
        <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs border border-gray-200">
          Unassigned
        </span>
      )}

      {lead.nextFollowUpDate && lead.nextFollowUpDate < Date.now() && (
        <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium border border-red-200">
          Overdue
        </span>
      )}
      
      {lead.assignedToName && !(lead as any).isRepeatLead && (
        <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs">
          👤 {lead.assignedToName}
        </span>
      )}

      {lead.coldCallerAssignedToName && (
        <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-xs border border-indigo-200">
          📞 {lead.coldCallerAssignedToName}
        </span>
      )}
    </div>
  );
}