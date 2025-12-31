import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import { useQuery, useMutation } from "convex/react";
import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Id } from "@/convex/_generated/dataModel";
import { useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Search, Loader2, RefreshCw } from "lucide-react";
import { useLocation } from "react-router";
import { toast } from "sonner";
import { useInView } from "react-intersection-observer";
import LeadDetails from "@/components/LeadDetails";
import { Id, Doc } from "@/convex/_generated/dataModel";
import { LeadCard } from "@/components/LeadCard";
import { OverdueLeadsDialog } from "@/components/leads/OverdueLeadsDialog";
import { CreateLeadDialog } from "@/components/leads/CreateLeadDialog";
import { AssignLeadDialog } from "@/components/leads/AssignLeadDialog";
import { LeadsFilterBar } from "@/components/leads/LeadsFilterBar";

export default function Leads() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const path = location.pathname;
  
  // Determine filter based on path
  const filter = path === "/my_leads" ? "mine" : path === "/all_leads" ? "all" : "unassigned";
  const title = path === "/my_leads" ? "My Leads" : path === "/all_leads" ? "All Leads" : "Unassigned Leads";

  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [selectedLeadId, setSelectedLeadId] = useState<Id<"leads"> | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [leadToAssign, setLeadToAssign] = useState<string | null>(null);
  const [followUpDate, setFollowUpDate] = useState<string>("");

  const allTags = useQuery(api.tags.getAllTags) || [];
  const uniqueSources = useQuery(api.leads.getUniqueSources) || [];
  const allUsers = useQuery(api.users.getAllUsers, user ? { userId: user._id } : "skip") || [];

  const manualSync = useAction(api.pharmavends.manualSyncPharmavends);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await manualSync();
      toast.success("Sync started in background");
    } catch (error) {
      toast.error("Failed to start sync");
      console.error(error);
    } finally {
      setIsSyncing(false);
    }
  };

  const assignLead = useMutation(api.leads.assignLead);

  const handleLeadSelect = (id: Id<"leads">) => {
    setSelectedLeadId(id);
  };

  const handleAssignToSelf = async (leadId: Id<"leads">) => {
    if (!user) return;
    setLeadToAssign(leadId);
    setFollowUpDate("");
    setIsAssignDialogOpen(true);
  };

  const handleAssignToUser = async (leadId: Id<"leads">, userId: Id<"users">) => {
    await assignLead({ leadId, userId });
  };

  const getMinDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 1);
    return now.toISOString().slice(0, 16);
  };

  const getMaxDateTime = () => {
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 31);
    return maxDate.toISOString().slice(0, 16);
  };

  const isAdmin = user?.role === "admin";
  const isUnassignedView = filter === "unassigned";

  const availableStatuses = ["Cold", "Hot", "Mature"];

  const sortedLeads = useMemo(() => {
    if (!leads) return [];
    return leads.sort((a, b) => {
      if (sortBy === "newest") return new Date(b.createdAt) - new Date(a.createdAt);
      if (sortBy === "oldest") return new Date(a.createdAt) - new Date(b.createdAt);
      return 0;
    });
  }, [leads, sortBy]);

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
          <p className="text-muted-foreground">
            Manage and track your leads
          </p>
        </div>
        <div className="flex gap-2">
          <CreateLeadDialog />
        </div>
      </div>

      <LeadsFilterBar 
        filter={filter} 
        setFilter={setFilter} 
        search={search} 
        setSearch={setSearch} 
        sortBy={sortBy} 
        setSortBy={setSortBy} 
      />

      <div className="flex-1 flex gap-4 min-h-0">
        {/* Leads List */}
        <div className={`${selectedLeadId ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-1/3 lg:w-1/4 min-w-[300px] border rounded-lg bg-card shadow-sm overflow-hidden`}>
          <div className="p-2 border-b bg-muted/50 text-sm font-medium text-muted-foreground flex justify-between items-center">
            <span>{sortedLeads.length} Leads</span>
            {filter === "all" && (
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                Admin View
              </span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {sortedLeads.map((lead) => (
              <LeadCard
                key={lead._id}
                lead={lead}
                isSelected={selectedLeadId === lead._id}
                isUnassignedView={filter === "unassigned"}
                viewIrrelevant={filter === "irrelevant"}
                isAdmin={user?.role === "admin"}
                allUsers={allUsers || []}
                onSelect={handleLeadSelect}
                onAssignToSelf={handleAssignToSelf}
                onAssignToUser={handleAssignToUser}
              />
            ))}
            {sortedLeads.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">
                No leads found matching your criteria.
              </div>
            )}
          </div>
        </div>

        {/* Lead Details */}
        {selectedLeadId ? (
          <div className="flex-1 min-w-0 h-full">
            <LeadDetails 
              leadId={selectedLeadId} 
              onClose={() => {
                const newParams = new URLSearchParams(searchParams);
                newParams.delete("leadId");
                setSearchParams(newParams);
              }} 
            />
          </div>
        ) : (
          <div className="hidden md:flex flex-1 items-center justify-center border rounded-lg bg-muted/10 text-muted-foreground">
            Select a lead to view details
          </div>
        )}
      </div>

      <AssignLeadDialog
        isOpen={isAssignDialogOpen}
        onClose={() => setIsAssignDialogOpen(false)}
        leadId={leadToAssign}
      />
    </div>
  );
}