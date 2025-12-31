import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { Mail, Plus, Trash2, Send, FileText, Edit, Users } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";
import { LeadSelector } from "@/components/LeadSelector";

export default function Emailing() {
  const { user } = useAuth();
  const templates = useQuery(api.emailTemplates.getAllTemplates) || [];
  const createTemplate = useMutation(api.emailTemplates.createTemplate);
  const updateTemplate = useMutation(api.emailTemplates.updateTemplate);
  const deleteTemplate = useMutation(api.emailTemplates.deleteTemplate);
  const sendEmailAction = useAction(api.emailActions.sendEmail);

  const isAdmin = user?.role === "admin";
  const leads = useQuery(api.leads.getLeads, user ? { 
    filter: isAdmin ? "all" : "mine" 
  } : "skip") || [];

  const [activeTab, setActiveTab] = useState("send");
  
  // Send Email State
  const [senderPrefix, setSenderPrefix] = useState("");
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [isLeadSelectorOpen, setIsLeadSelectorOpen] = useState(false);
  
  const [emailSubject, setEmailSubject] = useState("");
  const [emailContent, setEmailContent] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("none");

  // Template State
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<{id?: Id<"emailTemplates">, name: string, subject: string, content: string} | null>(null);

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!senderPrefix || selectedLeadIds.length === 0 || !emailSubject || !emailContent) {
      toast.error("Please fill in all fields and select at least one lead");
      return;
    }

    setIsSending(true);
    let successCount = 0;
    let failCount = 0;

    try {
      // Get selected leads with emails
      const recipients = leads.filter(l => selectedLeadIds.includes(l._id) && l.email);
      
      if (recipients.length === 0) {
        toast.error("Selected leads do not have valid email addresses");
        setIsSending(false);
        return;
      }

      toast.info(`Sending emails to ${recipients.length} recipients...`);

      // Send emails sequentially to avoid rate limits and better error tracking
      // For larger batches, this should be moved to a backend mutation/action that handles batching
      for (const lead of recipients) {
        if (!lead.email) continue;
        
        const result = await sendEmailAction({
          senderPrefix,
          to: lead.email,
          subject: emailSubject,
          htmlContent: emailContent,
        });

        if (result.success) {
          successCount++;
        } else {
          failCount++;
          console.error(`Failed to send to ${lead.email}:`, result.error);
        }
      }

      if (successCount > 0) {
        toast.success(`Successfully sent ${successCount} emails!`);
        if (failCount > 0) {
          toast.warning(`Failed to send ${failCount} emails.`);
        }
        
        // Clear form
        setSelectedLeadIds([]);
        setEmailSubject("");
        setEmailContent("");
        setSelectedTemplateId("none");
      } else {
        toast.error("Failed to send emails. Please check logs.");
      }
    } catch (error) {
      toast.error("An error occurred while sending emails");
      console.error(error);
    } finally {
      setIsSending(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!user) return;
    if (!editingTemplate?.name || !editingTemplate?.subject || !editingTemplate?.content) {
      toast.error("Please fill in all template fields");
      return;
    }

    try {
      if (editingTemplate.id) {
        await updateTemplate({
          id: editingTemplate.id,
          name: editingTemplate.name,
          subject: editingTemplate.subject,
          content: editingTemplate.content,
        });
        toast.success("Template updated");
      } else {
        await createTemplate({
          name: editingTemplate.name,
          subject: editingTemplate.subject,
          content: editingTemplate.content,
          userId: user._id,
        });
        toast.success("Template created");
      }
      setIsTemplateDialogOpen(false);
      setEditingTemplate(null);
    } catch (error) {
      toast.error("Failed to save template");
    }
  };

  const handleLoadTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (templateId === "none") {
      setEmailSubject("");
      setEmailContent("");
      return;
    }
    
    const template = templates.find(t => t._id === templateId);
    if (template) {
      setEmailSubject(template.subject);
      setEmailContent(template.content);
    }
  };

  const openNewTemplateDialog = () => {
    setEditingTemplate({ name: "", subject: "", content: "" });
    setIsTemplateDialogOpen(true);
  };

  const openEditTemplateDialog = (template: any) => {
    setEditingTemplate({
      id: template._id,
      name: template.name,
      subject: template.subject,
      content: template.content,
    });
    setIsTemplateDialogOpen(true);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Emailing</h1>
          <p className="text-muted-foreground">Send custom emails and manage templates.</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList>
            <TabsTrigger value="send" className="flex items-center gap-2">
              <Send className="h-4 w-4" /> Send Email
            </TabsTrigger>
            <TabsTrigger value="templates" className="flex items-center gap-2">
              <FileText className="h-4 w-4" /> Templates
            </TabsTrigger>
          </TabsList>

          <TabsContent value="send" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Compose Email</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSendEmail} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="sender">Sender Name</Label>
                      <div className="flex items-center gap-2">
                        <Input 
                          id="sender" 
                          placeholder="e.g. john" 
                          value={senderPrefix}
                          onChange={(e) => setSenderPrefix(e.target.value)}
                          className="flex-1"
                        />
                        <span className="text-sm text-muted-foreground whitespace-nowrap">@mail.cafoli.in</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Recipients</Label>
                      <div className="flex gap-2">
                        <Button 
                          type="button" 
                          variant="outline" 
                          className="w-full justify-start text-left font-normal"
                          onClick={() => setIsLeadSelectorOpen(true)}
                        >
                          <Users className="mr-2 h-4 w-4" />
                          {selectedLeadIds.length === 0 
                            ? "Select Leads..." 
                            : `${selectedLeadIds.length} lead(s) selected`}
                        </Button>
                      </div>
                      {selectedLeadIds.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Selected: {leads.filter(l => selectedLeadIds.includes(l._id)).map(l => l.name).slice(0, 3).join(", ")}
                          {selectedLeadIds.length > 3 && ` and ${selectedLeadIds.length - 3} more`}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="template">Load Template (Optional)</Label>
                    <Select value={selectedTemplateId} onValueChange={handleLoadTemplate}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a template" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {templates.map((t) => (
                          <SelectItem key={t._id} value={t._id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="subject">Subject</Label>
                    <Input 
                      id="subject" 
                      placeholder="Email subject" 
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="content">Content (HTML supported)</Label>
                    <Textarea 
                      id="content" 
                      placeholder="Write your email content here..." 
                      className="min-h-[300px] font-mono text-sm"
                      value={emailContent}
                      onChange={(e) => setEmailContent(e.target.value)}
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button type="submit" disabled={isSending || selectedLeadIds.length === 0}>
                      {isSending ? (
                        <>Sending...</>
                      ) : (
                        <>
                          <Send className="mr-2 h-4 w-4" /> Send Email ({selectedLeadIds.length})
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="templates" className="mt-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Email Templates</h2>
              <Button onClick={openNewTemplateDialog}>
                <Plus className="mr-2 h-4 w-4" /> New Template
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((template) => (
                <Card key={template._id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-medium flex justify-between items-start">
                      <span className="truncate" title={template.name}>{template.name}</span>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditTemplateDialog(template)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => deleteTemplate({ id: template._id })}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-2">Subject: {template.subject}</p>
                    <div className="text-xs text-muted-foreground line-clamp-3 bg-muted p-2 rounded">
                      {template.content}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {templates.length === 0 && (
                <div className="col-span-full text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                  No templates found. Create one to get started.
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingTemplate?.id ? "Edit Template" : "Create New Template"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="t-name">Template Name</Label>
                <Input 
                  id="t-name" 
                  value={editingTemplate?.name || ""} 
                  onChange={(e) => setEditingTemplate(prev => prev ? ({ ...prev, name: e.target.value }) : null)}
                  placeholder="e.g. Welcome Email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="t-subject">Default Subject</Label>
                <Input 
                  id="t-subject" 
                  value={editingTemplate?.subject || ""} 
                  onChange={(e) => setEditingTemplate(prev => prev ? ({ ...prev, subject: e.target.value }) : null)}
                  placeholder="Subject line"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="t-content">Content (HTML)</Label>
                <Textarea 
                  id="t-content" 
                  value={editingTemplate?.content || ""} 
                  onChange={(e) => setEditingTemplate(prev => prev ? ({ ...prev, content: e.target.value }) : null)}
                  placeholder="<html>...</html>"
                  className="min-h-[300px] font-mono text-sm"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsTemplateDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveTemplate}>Save Template</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <LeadSelector 
          isOpen={isLeadSelectorOpen}
          onClose={() => setIsLeadSelectorOpen(false)}
          leads={leads as any[]}
          selectedLeadIds={selectedLeadIds}
          onSelectionChange={setSelectedLeadIds}
        />
      </div>
    </AppLayout>
  );
}