import AppLayout from "@/components/AppLayout";
import { ChatWindow } from "@/components/whatsapp/ChatWindow";
import { ContactList } from "@/components/whatsapp/ContactList";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { ROLES } from "@/convex/schema";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useAction } from "convex/react";
import { MessageSquare, Settings } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function WhatsApp() {
  const { user } = useAuth();
  
  // Determine filter based on user role
  const filter = user?.role === ROLES.ADMIN ? "all" : "mine";
  // Use new query that includes chat status and sorting
  const leads = useQuery(api.whatsappQueries.getLeadsWithChatStatus, { filter, userId: user?._id }) || [];
  
  const [selectedLeadId, setSelectedLeadId] = useState<Id<"leads"> | null>(null);
  const selectedLead = leads.find((l: any) => l._id === selectedLeadId);

  const updateInterface = useAction(api.whatsapp.updateWhatsAppInterface);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdateInterface = async () => {
    setIsUpdating(true);
    try {
      const result = await updateInterface();
      if (result.errors.length > 0) {
        console.error(result.errors);
        toast.error("Some updates failed. Check console.");
      } else {
        toast.success("WhatsApp interface updated successfully");
      }
    } catch (error) {
      toast.error("Failed to update interface");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        <div className="flex-shrink-0 p-6 pb-4 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">WhatsApp Messaging</h1>
            <p className="text-muted-foreground">
              {user?.role === ROLES.ADMIN 
                ? "Send WhatsApp messages to all leads." 
                : "Send WhatsApp messages to your assigned leads."}
            </p>
          </div>
          {user?.role === ROLES.ADMIN && (
            <Button 
              variant="outline" 
              onClick={handleUpdateInterface}
              disabled={isUpdating}
            >
              <Settings className="mr-2 h-4 w-4" />
              {isUpdating ? "Syncing..." : "Sync Interface"}
            </Button>
          )}
        </div>

        <div className="flex-1 grid md:grid-cols-[350px_1fr] gap-4 px-6 pb-6 min-h-0 overflow-hidden">
          {/* Contacts List */}
          <ContactList 
            leads={leads} 
            selectedLeadId={selectedLeadId} 
            onSelectLead={setSelectedLeadId} 
          />

          {/* Chat Area */}
          {selectedLeadId && selectedLead ? (
            <ChatWindow 
              selectedLeadId={selectedLeadId} 
              selectedLead={selectedLead} 
            />
          ) : (
            <Card className="flex flex-col h-full overflow-hidden items-center justify-center">
              <div className="text-center">
                <MessageSquare className="h-20 w-20 mx-auto mb-4 text-muted-foreground/20" />
                <p className="text-lg font-semibold mb-2">Select a contact</p>
                <p className="text-muted-foreground">Choose a contact to start messaging</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
}