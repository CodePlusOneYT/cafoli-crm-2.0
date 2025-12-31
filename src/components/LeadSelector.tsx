import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";

interface Lead {
  _id: Id<"leads">;
  name: string;
  email?: string;
  status?: string;
  source?: string;
}

interface LeadSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  leads: Lead[];
  selectedLeadIds: string[];
  onSelectionChange: (ids: string[]) => void;
}

export function LeadSelector({ isOpen, onClose, leads, selectedLeadIds, onSelectionChange }: LeadSelectorProps) {
  const [search, setSearch] = useState("");

  const filteredLeads = useMemo(() => {
    // Only consider leads with emails
    const leadsWithEmails = leads.filter(l => l.email);
    
    if (!search) return leadsWithEmails;
    
    const lowerSearch = search.toLowerCase();
    return leadsWithEmails.filter(l => 
      l.name.toLowerCase().includes(lowerSearch) || 
      l.email!.toLowerCase().includes(lowerSearch) ||
      (l.status && l.status.toLowerCase().includes(lowerSearch)) ||
      (l.source && l.source.toLowerCase().includes(lowerSearch))
    );
  }, [leads, search]);

  const handleSelectAll = () => {
    const allFilteredIds = filteredLeads.map(l => l._id);
    // If all filtered are already selected, deselect them. Otherwise select all filtered.
    const allFilteredSelected = allFilteredIds.every(id => selectedLeadIds.includes(id));
    
    if (allFilteredSelected) {
      // Deselect all currently filtered leads
      onSelectionChange(selectedLeadIds.filter(id => !allFilteredIds.includes(id as Id<"leads">)));
    } else {
      // Select all currently filtered leads (merge with existing selection)
      const newIds = Array.from(new Set([...selectedLeadIds, ...allFilteredIds]));
      onSelectionChange(newIds);
    }
  };

  const toggleLead = (id: string) => {
    if (selectedLeadIds.includes(id)) {
      onSelectionChange(selectedLeadIds.filter(i => i !== id));
    } else {
      onSelectionChange([...selectedLeadIds, id]);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Select Leads</DialogTitle>
        </DialogHeader>
        
        <div className="flex gap-2 my-4">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search by name, email, status..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Button variant="outline" onClick={handleSelectAll}>
            {filteredLeads.length > 0 && filteredLeads.every(l => selectedLeadIds.includes(l._id)) 
              ? "Deselect All" 
              : "Select All"}
          </Button>
        </div>

        <div className="flex-1 overflow-hidden border rounded-md">
          <ScrollArea className="h-[400px]">
            <div className="p-4 space-y-2">
              {filteredLeads.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No leads found with email addresses matching your search.</p>
              ) : (
                filteredLeads.map((lead) => (
                  <div key={lead._id} className="flex items-center space-x-3 p-2 hover:bg-accent rounded-md">
                    <Checkbox 
                      id={`lead-${lead._id}`} 
                      checked={selectedLeadIds.includes(lead._id)}
                      onCheckedChange={() => toggleLead(lead._id)}
                    />
                    <div className="flex-1 grid gap-1">
                      <label htmlFor={`lead-${lead._id}`} className="text-sm font-medium leading-none cursor-pointer">
                        {lead.name}
                      </label>
                      <p className="text-xs text-muted-foreground">
                        {lead.email} • {lead.status || "No Status"} • {lead.source || "No Source"}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="flex justify-between items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            {selectedLeadIds.length} lead(s) selected
          </div>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
