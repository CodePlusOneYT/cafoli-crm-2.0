import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery, usePaginatedQuery, useAction } from "convex/react";
import { Search, Plus, UserPlus, Loader2, RefreshCw, X } from "lucide-react";
import { useState, type FormEvent, useEffect } from "react";
import { useLocation } from "react-router";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useInView } from "react-intersection-observer";
import LeadDetails from "@/components/LeadDetails";
import { Id, Doc } from "@/convex/_generated/dataModel";
import { LeadCard } from "@/components/LeadCard";
import { Check, ChevronsUpDown } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

export default function Leads() {
  const location = useLocation();
  const path = location.pathname;
  const { user } = useAuth();
  
  // Determine filter based on path
  const filter = path === "/my_leads" ? "mine" : path === "/all_leads" ? "all" : "unassigned";
  const title = path === "/my_leads" ? "My Leads" : path === "/all_leads" ? "All Leads" : "Unassigned Leads";

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [viewIrrelevant, setViewIrrelevant] = useState(false);
  
  // New unified filter states
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedAssignedTo, setSelectedAssignedTo] = useState<string[]>([]);

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

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { 
    results: leads, 
    status, 
    loadMore, 
  } = usePaginatedQuery(
    api.leads.getPaginatedLeads, 
    { 
      filter: viewIrrelevant ? "irrelevant" : filter, 
      userId: user?._id,
      search: debouncedSearch || undefined,
      statuses: selectedStatuses.length > 0 ? selectedStatuses : undefined,
      sources: selectedSources.length > 0 ? selectedSources : undefined,
      tags: selectedTags.length > 0 ? selectedTags as Id<"tags">[] : undefined,
      assignedToUsers: selectedAssignedTo.length > 0 ? selectedAssignedTo as Id<"users">[] : undefined,
    }, 
    { initialNumItems: 20 }
  );

  // Overdue Leads Popup Logic
  const overdueLeads = useQuery(api.leads.getOverdueLeads, filter === "mine" && user ? { userId: user._id } : "skip");
  const [isOverduePopupOpen, setIsOverduePopupOpen] = useState(false);
  const [hasShownOverduePopup, setHasShownOverduePopup] = useState(false);

  useEffect(() => {
    if (filter === "mine" && overdueLeads && overdueLeads.length > 0 && !hasShownOverduePopup) {
      setIsOverduePopupOpen(true);
      setHasShownOverduePopup(true);
    }
  }, [filter, overdueLeads, hasShownOverduePopup]);

  const { ref, inView } = useInView();

  useEffect(() => {
    if (inView && status === "CanLoadMore") {
      loadMore(20);
    }
  }, [inView, status, loadMore]);

  const createLead = useMutation(api.leads.createLead);
  const assignLead = useMutation(api.leads.assignLead);

  const [selectedLeadId, setSelectedLeadId] = useState<Id<"leads"> | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [leadToAssign, setLeadToAssign] = useState<string | null>(null);
  const [followUpDate, setFollowUpDate] = useState<string>("");

  const handleAssignToSelf = async (leadId: string) => {
    if (!user) return;
    setLeadToAssign(leadId);
    setFollowUpDate("");
    setIsAssignDialogOpen(true);
  };

  const confirmAssignToSelf = async () => {
    if (!user || !leadToAssign) return;
    
    if (!followUpDate) {
      toast.error("Setting follow-up date is compulsory");
      return;
    }
    
    const followUpTimestamp = new Date(followUpDate).getTime();
    
    try {
      await assignLead({ 
        leadId: leadToAssign as any, 
        userId: user._id, 
        adminId: user._id,
        nextFollowUpDate: followUpTimestamp
      });
      toast.success("Lead assigned to you with follow-up date set");
      setIsAssignDialogOpen(false);
      setLeadToAssign(null);
      setFollowUpDate("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to assign lead");
    }
  };

  const handleAssignToUser = async (leadId: string, userId: string) => {
    if (!user) return;
    try {
      await assignLead({ leadId: leadId as any, userId: userId as any, adminId: user._id });
      toast.success("Lead assigned successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to assign lead");
    }
  };

  const handleCreateLead = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const formData = new FormData(e.currentTarget);
    try {
      await createLead({
        name: formData.get("name") as string,
        subject: formData.get("subject") as string,
        source: "Manual",
        mobile: formData.get("mobile") as string,
        email: formData.get("email") as string || undefined,
        agencyName: formData.get("agencyName") as string || undefined,
        message: formData.get("message") as string || undefined,
        userId: user._id,
      });
      setIsCreateOpen(false);
      toast.success("Lead created successfully");
    } catch (error) {
      toast.error("Failed to create lead");
    }
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

  // Helper to toggle filter selection
  const toggleFilter = (value: string, currentFilters: string[], setFilters: (filters: string[]) => void) => {
    if (currentFilters.includes(value)) {
      setFilters(currentFilters.filter(f => f !== value));
    } else {
      setFilters([...currentFilters, value]);
    }
  };

  const clearAllFilters = () => {
    setSelectedStatuses([]);
    setSelectedSources([]);
    setSelectedTags([]);
    setSelectedAssignedTo([]);
  };

  const hasActiveFilters = selectedStatuses.length > 0 || selectedSources.length > 0 || 
                          selectedTags.length > 0 || selectedAssignedTo.length > 0;

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-8rem)]">
        {/* Overdue Leads Popup */}
        <Dialog open={isOverduePopupOpen} onOpenChange={setIsOverduePopupOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-red-600 flex items-center gap-2">
                ⚠️ Overdue Follow-ups ({overdueLeads?.length})
              </DialogTitle>
              <DialogDescription>
                You have the following leads with overdue follow-ups. Please take action.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 mt-4">
              {overdueLeads?.map((lead: Doc<"leads">) => (
                <div 
                  key={lead._id} 
                  className="p-3 border border-red-200 bg-red-50 rounded-lg flex justify-between items-center cursor-pointer hover:bg-red-100 transition-colors"
                  onClick={() => {
                    setSelectedLeadId(lead._id);
                    setIsOverduePopupOpen(false);
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

        <div className="flex flex-col gap-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                {viewIrrelevant ? "Irrelevant Leads" : title}
              </h1>
              <p className="text-muted-foreground">Manage your leads and communications.</p>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={handleSync}
                disabled={isSyncing}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
                Sync Leads
              </Button>

              <Button 
                variant={viewIrrelevant ? "secondary" : "outline"}
                onClick={() => setViewIrrelevant(!viewIrrelevant)}
              >
                {viewIrrelevant ? "Show Active Leads" : "Show Irrelevant Leads"}
              </Button>

              <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Lead
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Lead</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreateLead} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Name</label>
                        <Input name="name" required placeholder="John Doe" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Subject</label>
                        <Input name="subject" required placeholder="Inquiry about..." />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Mobile</label>
                        <Input name="mobile" required placeholder="+1234567890" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Email</label>
                        <Input name="email" type="email" placeholder="john@example.com" />
                      </div>
                      <div className="col-span-2 space-y-2">
                        <label className="text-sm font-medium">Agency Name</label>
                        <Input name="agencyName" placeholder="Company Ltd." />
                      </div>
                      <div className="col-span-2 space-y-2">
                        <label className="text-sm font-medium">Message</label>
                        <Textarea name="message" placeholder="Initial message..." />
                      </div>
                    </div>
                    <Button type="submit" className="w-full">Create Lead</Button>
                  </form>
                </DialogContent>
              </Dialog>

              {/* Follow-up Date Assignment Dialog */}
              <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
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
                        min={getMinDateTime()}
                        max={getMaxDateTime()}
                        required
                      />
                      <p className="text-xs text-muted-foreground">
                        Must be between now and 31 days in the future
                      </p>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setIsAssignDialogOpen(false);
                          setLeadToAssign(null);
                          setFollowUpDate("");
                        }}
                      >
                        Cancel
                      </Button>
                      <Button onClick={confirmAssignToSelf}>
                        Assign Lead
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Unified Filters Row */}
          <div className="flex flex-col gap-3">
            <div className="flex gap-2 items-center flex-wrap">
              {/* Status Filter */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-between">
                    Status {selectedStatuses.length > 0 && `(${selectedStatuses.length})`}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-0">
                  <Command>
                    <CommandInput placeholder="Search status..." />
                    <CommandList>
                      <CommandEmpty>No status found.</CommandEmpty>
                      <CommandGroup>
                        {availableStatuses.map((status) => (
                          <CommandItem
                            key={status}
                            value={status}
                            onSelect={() => toggleFilter(status, selectedStatuses, setSelectedStatuses)}
                          >
                            <span className="flex-1">{status}</span>
                            {selectedStatuses.includes(status) && (
                              <Check className="h-4 w-4 ml-auto" />
                            )}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              {/* Source Filter */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-between">
                    Source {selectedSources.length > 0 && `(${selectedSources.length})`}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-0">
                  <Command>
                    <CommandInput placeholder="Search source..." />
                    <CommandList>
                      <CommandEmpty>No source found.</CommandEmpty>
                      <CommandGroup>
                        {uniqueSources.map((source) => (
                          <CommandItem
                            key={source}
                            value={source}
                            onSelect={() => toggleFilter(source, selectedSources, setSelectedSources)}
                          >
                            <span className="flex-1">{source}</span>
                            {selectedSources.includes(source) && (
                              <Check className="h-4 w-4 ml-auto" />
                            )}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              {/* Tag Filter */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-between">
                    Tags {selectedTags.length > 0 && `(${selectedTags.length})`}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-0">
                  <Command>
                    <CommandInput placeholder="Search tags..." />
                    <CommandList>
                      <CommandEmpty>No tags found.</CommandEmpty>
                      <CommandGroup>
                        {allTags.map((tag) => (
                          <CommandItem
                            key={tag._id}
                            value={tag.name}
                            onSelect={() => toggleFilter(tag._id, selectedTags, setSelectedTags)}
                          >
                            <div 
                              className="w-3 h-3 rounded-full mr-2" 
                              style={{ backgroundColor: tag.color }}
                            />
                            <span className="flex-1">{tag.name}</span>
                            {selectedTags.includes(tag._id) && (
                              <Check className="h-4 w-4 ml-auto" />
                            )}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              {/* Assigned To Filter (Admin Only) */}
              {isAdmin && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="justify-between">
                      Assigned To {selectedAssignedTo.length > 0 && `(${selectedAssignedTo.length})`}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[200px] p-0">
                    <Command>
                      <CommandInput placeholder="Search users..." />
                      <CommandList>
                        <CommandEmpty>No users found.</CommandEmpty>
                        <CommandGroup>
                          {allUsers.map((u) => (
                            <CommandItem
                              key={u._id}
                              value={u.name || u.email || ""}
                              onSelect={() => toggleFilter(u._id, selectedAssignedTo, setSelectedAssignedTo)}
                            >
                              <span className="flex-1">{u.name || u.email}</span>
                              {selectedAssignedTo.includes(u._id) && (
                                <Check className="h-4 w-4 ml-auto" />
                              )}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              )}

              {/* Clear All Filters */}
              {hasActiveFilters && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={clearAllFilters}
                  className="h-9 px-3"
                >
                  Clear All
                  <X className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Active Filters Display */}
            {hasActiveFilters && (
              <div className="flex flex-wrap gap-2">
                {selectedStatuses.map(status => (
                  <Badge key={status} variant="secondary" className="gap-1">
                    {status}
                    <X 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={() => toggleFilter(status, selectedStatuses, setSelectedStatuses)}
                    />
                  </Badge>
                ))}
                {selectedSources.map(source => (
                  <Badge key={source} variant="secondary" className="gap-1">
                    {source}
                    <X 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={() => toggleFilter(source, selectedSources, setSelectedSources)}
                    />
                  </Badge>
                ))}
                {selectedTags.map(tagId => {
                  const tag = allTags.find(t => t._id === tagId);
                  return tag ? (
                    <Badge key={tagId} variant="secondary" className="gap-1" style={{ backgroundColor: tag.color, color: 'white' }}>
                      {tag.name}
                      <X 
                        className="h-3 w-3 cursor-pointer" 
                        onClick={() => toggleFilter(tagId, selectedTags, setSelectedTags)}
                      />
                    </Badge>
                  ) : null;
                })}
                {selectedAssignedTo.map(userId => {
                  const u = allUsers.find(user => user._id === userId);
                  return u ? (
                    <Badge key={userId} variant="secondary" className="gap-1">
                      👤 {u.name || u.email}
                      <X 
                        className="h-3 w-3 cursor-pointer" 
                        onClick={() => toggleFilter(userId, selectedAssignedTo, setSelectedAssignedTo)}
                      />
                    </Badge>
                  ) : null;
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-6 flex-1 overflow-hidden">
          {/* Lead List */}
          <div className={`w-full md:w-1/3 flex flex-col gap-4 ${selectedLeadId ? 'hidden md:flex' : 'flex'}`}>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search leads..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-2">
              {leads?.map((lead: Doc<"leads">) => (
                <LeadCard
                  key={lead._id}
                  lead={lead}
                  isSelected={selectedLeadId === lead._id}
                  isUnassignedView={isUnassignedView}
                  viewIrrelevant={viewIrrelevant}
                  isAdmin={isAdmin}
                  allUsers={allUsers}
                  onSelect={setSelectedLeadId}
                  onAssignToSelf={(id) => handleAssignToSelf(id)}
                  onAssignToUser={(leadId, userId) => handleAssignToUser(leadId, userId)}
                />
              ))}
              
              {/* Loading indicator and infinite scroll trigger */}
              <div ref={ref} className="py-4 flex justify-center">
                {status === "LoadingMore" && (
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                )}
                {status === "Exhausted" && leads?.length > 0 && (
                  <span className="text-xs text-muted-foreground">No more leads</span>
                )}
                {status === "LoadingFirstPage" && (
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                )}
                {status === "Exhausted" && leads?.length === 0 && (
                  <span className="text-sm text-muted-foreground">No leads found</span>
                )}
              </div>
            </div>
          </div>

          {/* Lead Details */}
          {selectedLeadId ? (
            <LeadDetails 
              leadId={selectedLeadId} 
              onClose={() => setSelectedLeadId(null)} 
            />
          ) : (
            <div className="hidden md:flex flex-1 items-center justify-center text-muted-foreground bg-muted/10 rounded-lg border border-dashed">
              Select a lead to view details
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}