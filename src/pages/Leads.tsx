import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery, usePaginatedQuery } from "convex/react";
import { Search, Plus, UserPlus, Loader2 } from "lucide-react";
import { useState, type FormEvent, useEffect } from "react";
import { useLocation } from "react-router";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useInView } from "react-intersection-observer";
import LeadDetails from "@/components/LeadDetails";
import { Id } from "@/convex/_generated/dataModel";

export default function Leads() {
  const location = useLocation();
  const path = location.pathname;
  const { user } = useAuth();
  
  // Determine filter based on path
  const filter = path === "/my_leads" ? "mine" : path === "/all_leads" ? "all" : "unassigned";
  const title = path === "/my_leads" ? "My Leads" : path === "/all_leads" ? "All Leads" : "Unassigned Leads";

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

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
      filter, 
      userId: user?._id,
      search: debouncedSearch || undefined
    }, 
    { initialNumItems: 20 }
  );

  const { ref, inView } = useInView();

  useEffect(() => {
    if (inView && status === "CanLoadMore") {
      loadMore(20);
    }
  }, [inView, status, loadMore]);

  const allUsers = useQuery(api.users.getAllUsers, user ? { userId: user._id } : "skip") || [];
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

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-8rem)]">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
            <p className="text-muted-foreground">Manage your leads and communications.</p>
          </div>
          <div className="flex gap-2">
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
              {leads?.map((lead) => (
                <Card
                  key={lead._id}
                  className={`cursor-pointer transition-colors hover:bg-accent/50 ${
                    selectedLeadId === lead._id ? "border-primary bg-accent/50" : ""
                  }`}
                  onClick={() => setSelectedLeadId(lead._id)}
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold truncate">{lead.name}</h3>
                      <span className="text-xs text-muted-foreground">
                        {new Date(lead._creationTime).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate mb-2">{lead.subject}</p>
                    <div className="flex gap-2 text-xs flex-wrap items-center">
                      <span className="bg-secondary px-2 py-0.5 rounded-full">{lead.source}</span>
                      <span className={`px-2 py-0.5 rounded-full ${
                        lead.status === 'Hot' ? 'bg-red-100 text-red-700' :
                        lead.status === 'Mature' ? 'bg-green-100 text-green-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>{lead.status}</span>
                      {lead.nextFollowUpDate && lead.nextFollowUpDate < Date.now() && (
                        <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                          Overdue
                        </span>
                      )}
                      {isUnassignedView && !lead.assignedTo && (
                        <>
                          {!isAdmin ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAssignToSelf(lead._id);
                              }}
                            >
                              <UserPlus className="h-3 w-3 mr-1" />
                              Assign to me
                            </Button>
                          ) : (
                            <Select
                              onValueChange={(userId) => {
                                handleAssignToUser(lead._id, userId);
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
                    </div>
                  </CardContent>
                </Card>
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