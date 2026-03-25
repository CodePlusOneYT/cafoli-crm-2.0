import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Plus, RefreshCw, CheckCircle, Clock, XCircle, Info, Trash2, Edit, Send as SendIcon, Upload } from "lucide-react";
import { useState } from "react";
import { useQuery, useAction } from "convex/react";
import { getConvexApi } from "@/lib/convex-api";

const api = getConvexApi() as any;
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { Id } from "@/convex/_generated/dataModel";
import { useAuth } from "@/hooks/use-auth";
import { ROLES } from "@/lib/constants";

interface TemplatesDialogProps {
  selectedLeadId?: Id<"leads"> | null;
}

// Extract variable placeholders like {{1}}, {{2}}, {{name}} from template text
function extractVariables(text: string): string[] {
  const matches = text.match(/\{\{([^}]+)\}\}/g) || [];
  return [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, "")))];
}

export function TemplatesDialog({ selectedLeadId }: TemplatesDialogProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  
  const templates = useQuery(api.whatsappTemplatesQueries.getTemplates) || [];
  // Fetch the specific lead directly by ID — avoids the 1000-lead cap issue
  const specificLead = useQuery(
    api.leads.queries.getLead,
    selectedLeadId ? { id: selectedLeadId, userId: user?._id } : "skip"
  );
  // Only load the full leads list when no specific lead is provided (for the contact picker)
  const filter = user?.role === ROLES.ADMIN ? "all" : "mine";
  const leads = useQuery(
    api.leads.queries.getLeads,
    !selectedLeadId ? { filter, userId: user?._id } : "skip"
  ) || [];
  
  const syncTemplates = useAction(api.whatsappTemplates.syncTemplates);
  const createTemplate = useAction(api.whatsappTemplates.createTemplate);
  const deleteTemplate = useAction(api.whatsappTemplates.deleteTemplate);
  const sendTemplateMessage = useAction(api.whatsappTemplates.sendTemplateMessage);

  const [formData, setFormData] = useState({
    name: "",
    language: "en_US",
    category: "MARKETING",
    headerType: "TEXT",
    headerText: "",
    bodyText: "",
    footerText: "",
  });

  const [sendFormData, setSendFormData] = useState({
    leadId: "" as Id<"leads"> | "",
    mediaUrl: "",
    variables: {} as Record<string, string>,
  });

  // Derive template requirements from selected template
  const getTemplateRequirements = (template: any) => {
    if (!template) return { headerFormat: null, bodyVariables: [] };
    const headerComp = template.components?.find((c: any) => c.type === "HEADER");
    const bodyComp = template.components?.find((c: any) => c.type === "BODY");
    const headerFormat = headerComp?.format || null; // "TEXT", "IMAGE", "DOCUMENT", "VIDEO", or null
    const bodyVariables = bodyComp?.text ? extractVariables(bodyComp.text) : [];
    return { headerFormat, bodyVariables };
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const result = await syncTemplates({});
      toast.success(`Synced ${result.count} templates from Meta`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to sync templates");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.name || !formData.bodyText) {
      toast.error("Template name and body are required");
      return;
    }

    setIsCreating(true);
    try {
      const components = [];
      
      if (formData.headerType !== "NONE" && formData.headerText) {
        components.push({
          type: "HEADER",
          format: formData.headerType,
          text: formData.headerType === "TEXT" ? formData.headerText : undefined,
        });
      }
      
      components.push({
        type: "BODY",
        text: formData.bodyText,
      });
      
      if (formData.footerText) {
        components.push({
          type: "FOOTER",
          text: formData.footerText,
        });
      }

      await createTemplate({
        name: formData.name,
        language: formData.language,
        category: formData.category,
        components,
      });

      toast.success("Template created successfully. Awaiting Meta approval.");
      setFormData({
        name: "",
        language: "en_US",
        category: "MARKETING",
        headerType: "TEXT",
        headerText: "",
        bodyText: "",
        footerText: "",
      });
      setIsCreating(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create template");
      setIsCreating(false);
    }
  };

  const handleDelete = async (template: any) => {
    if (!confirm(`Are you sure you want to delete the template "${template.name}"?`)) {
      return;
    }

    try {
      await deleteTemplate({
        templateName: template.name,
        templateId: template._id,
      });
      toast.success("Template deleted successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete template");
    }
  };

  const handleEdit = (template: any) => {
    const headerComponent = template.components.find((c: any) => c.type === "HEADER");
    const bodyComponent = template.components.find((c: any) => c.type === "BODY");
    const footerComponent = template.components.find((c: any) => c.type === "FOOTER");

    setFormData({
      name: template.name + "_v2",
      language: template.language,
      category: template.category,
      headerType: headerComponent?.format || "NONE",
      headerText: headerComponent?.text || "",
      bodyText: bodyComponent?.text || "",
      footerText: footerComponent?.text || "",
    });

    const createTab = document.querySelector('[value="create"]') as HTMLElement;
    createTab?.click();
    
    toast.info("Editing creates a new template version (Meta limitation)");
  };

  // Open the send dialog for a template (always show dialog to fill variables/media)
  const openSendDialog = (template: any, leadId?: Id<"leads">) => {
    setSelectedTemplate(template);
    const { bodyVariables } = getTemplateRequirements(template);
    // Pre-fill variables with empty strings
    const initialVars: Record<string, string> = {};
    bodyVariables.forEach(v => { initialVars[v] = ""; });
    setSendFormData({
      leadId: leadId || "" as any,
      mediaUrl: "",
      variables: initialVars,
    });
    setSendDialogOpen(true);
  };

  const handleSendTemplate = async () => {
    if (!selectedTemplate) {
      toast.error("No template selected");
      return;
    }

    const targetLeadId = sendFormData.leadId || selectedLeadId;
    
    if (!targetLeadId) {
      toast.error("Please select a contact");
      return;
    }

    // Use specificLead if it matches, otherwise search the leads list
    const lead = (specificLead && specificLead._id === targetLeadId)
      ? specificLead
      : leads.find((l: any) => l._id === targetLeadId);

    if (!lead) {
      toast.error("Contact not found. Please try again.");
      return;
    }

    if (!lead.mobile || lead.mobile.trim() === "") {
      toast.error("Contact has no phone number");
      return;
    }

    const { headerFormat, bodyVariables } = getTemplateRequirements(selectedTemplate);

    // Validate media URL if required
    if (["IMAGE", "DOCUMENT", "VIDEO"].includes(headerFormat || "") && !sendFormData.mediaUrl.trim()) {
      toast.error(`Please provide a ${headerFormat?.toLowerCase()} URL for the header`);
      return;
    }

    // Validate all body variables are filled
    for (const varName of bodyVariables) {
      if (!sendFormData.variables[varName]?.trim()) {
        toast.error(`Please fill in the variable: {{${varName}}}`);
        return;
      }
    }

    setIsSending(true);
    try {
      await sendTemplateMessage({
        phoneNumber: lead.mobile,
        templateName: selectedTemplate.name,
        languageCode: selectedTemplate.language,
        leadId: lead._id,
        mediaUrl: sendFormData.mediaUrl.trim() || undefined,
        variables: Object.keys(sendFormData.variables).length > 0 ? sendFormData.variables : undefined,
      });
      toast.success("Template message sent successfully");
      setSendDialogOpen(false);
      setSelectedTemplate(null);
      setSendFormData({ leadId: "" as any, mediaUrl: "", variables: {} });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send template");
    } finally {
      setIsSending(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "APPROVED":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "PENDING":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "REJECTED":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const insertFormatting = (format: string) => {
    const textarea = document.getElementById("body") as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = formData.bodyText.substring(start, end);
    
    let formattedText = "";
    switch (format) {
      case "bold":
        formattedText = `*${selectedText || "bold text"}*`;
        break;
      case "italic":
        formattedText = `_${selectedText || "italic text"}_`;
        break;
      case "strikethrough":
        formattedText = `~${selectedText || "strikethrough text"}~`;
        break;
      case "monospace":
        formattedText = `\`\`\`${selectedText || "monospace text"}\`\`\``;
        break;
    }

    const newText = formData.bodyText.substring(0, start) + formattedText + formData.bodyText.substring(end);
    setFormData({ ...formData, bodyText: newText });
  };

  const { headerFormat, bodyVariables } = getTemplateRequirements(selectedTemplate);
  const needsMedia = ["IMAGE", "DOCUMENT", "VIDEO"].includes(headerFormat || "");

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <FileText className="h-4 w-4 mr-2" />
            Templates
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>WhatsApp Message Templates</DialogTitle>
            <DialogDescription>
              Manage your WhatsApp message templates synced with Meta Business API
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="list" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="list">Templates ({templates.length})</TabsTrigger>
              <TabsTrigger value="create">Create New</TabsTrigger>
            </TabsList>

            <TabsContent value="list" className="space-y-4">
              <div className="flex justify-end">
                <Button onClick={handleSync} disabled={isSyncing} size="sm">
                  <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? "animate-spin" : ""}`} />
                  Sync from Meta
                </Button>
              </div>

              <div className="space-y-2">
                {templates.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No templates found. Click "Sync from Meta" or create a new template.
                  </div>
                ) : (
                  templates.map((template: any) => (
                    <div key={template._id} className="border rounded-lg p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold">{template.name}</h4>
                          {getStatusIcon(template.status)}
                          <Badge variant={template.status === "APPROVED" ? "default" : "secondary"}>
                            {template.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{template.category}</Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openSendDialog(template, selectedLeadId || undefined)}
                            title="Send template"
                            disabled={template.status !== "APPROVED"}
                          >
                            <SendIcon className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleEdit(template)}
                            title="Edit template"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(template)}
                            title="Delete template"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">Language: {template.language}</p>
                      <div className="text-sm space-y-1">
                        {template.components.map((comp: any, idx: number) => (
                          <div key={idx} className="bg-muted/50 p-2 rounded">
                            <span className="font-medium text-xs">{comp.type}</span>
                            {comp.format && <span className="text-xs text-muted-foreground"> ({comp.format})</span>}
                            {": "}
                            <span className="text-xs">{comp.text || "(No text)"}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="create" className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Templates must be approved by Meta before use. This typically takes 24-48 hours.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Template Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g., welcome_message"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">Use lowercase and underscores only</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="language">Language</Label>
                    <Select value={formData.language} onValueChange={(value) => setFormData({ ...formData, language: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en_US">English (US)</SelectItem>
                        <SelectItem value="en_GB">English (UK)</SelectItem>
                        <SelectItem value="es">Spanish</SelectItem>
                        <SelectItem value="fr">French</SelectItem>
                        <SelectItem value="de">German</SelectItem>
                        <SelectItem value="hi">Hindi</SelectItem>
                        <SelectItem value="ar">Arabic</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MARKETING">Marketing</SelectItem>
                        <SelectItem value="UTILITY">Utility</SelectItem>
                        <SelectItem value="AUTHENTICATION">Authentication</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="headerType">Header Type</Label>
                  <Select value={formData.headerType} onValueChange={(value) => setFormData({ ...formData, headerType: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">None</SelectItem>
                      <SelectItem value="TEXT">Text</SelectItem>
                      <SelectItem value="IMAGE">Image</SelectItem>
                      <SelectItem value="VIDEO">Video</SelectItem>
                      <SelectItem value="DOCUMENT">Document</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.headerType === "TEXT" && (
                  <div className="space-y-2">
                    <Label htmlFor="header">Header Text</Label>
                    <Input
                      id="header"
                      placeholder="Header text (max 60 characters)"
                      maxLength={60}
                      value={formData.headerText}
                      onChange={(e) => setFormData({ ...formData, headerText: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">{formData.headerText.length}/60 characters</p>
                  </div>
                )}

                {(formData.headerType === "IMAGE" || formData.headerType === "VIDEO" || formData.headerType === "DOCUMENT") && (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      Media headers must be uploaded separately via Meta Business Manager after template creation.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="body">Body Text *</Label>
                  <div className="flex gap-2 mb-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => insertFormatting("bold")} title="Bold">
                      <strong>B</strong>
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => insertFormatting("italic")} title="Italic">
                      <em>I</em>
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => insertFormatting("strikethrough")} title="Strikethrough">
                      <s>S</s>
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => insertFormatting("monospace")} title="Monospace">
                      <code>{"</>"}</code>
                    </Button>
                  </div>
                  <Textarea
                    id="body"
                    placeholder="Your message body... (max 1024 characters)"
                    rows={6}
                    maxLength={1024}
                    value={formData.bodyText}
                    onChange={(e) => setFormData({ ...formData, bodyText: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    {formData.bodyText.length}/1024 characters | Formatting: *bold* _italic_ ~strikethrough~ 
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="footer">Footer (Optional)</Label>
                  <Input
                    id="footer"
                    placeholder="Footer text"
                    value={formData.footerText}
                    onChange={(e) => setFormData({ ...formData, footerText: e.target.value })}
                  />
                </div>

                <Button onClick={handleCreate} disabled={isCreating} className="w-full">
                  {isCreating ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Template
                    </>
                  )}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Send Template Dialog */}
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Send Template: {selectedTemplate?.name}</DialogTitle>
            <DialogDescription>
              {selectedLeadId
                ? `Sending to ${specificLead?.name || "selected contact"} (${specificLead?.mobile || ""})`
                : "Fill in the details below to send this template"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Contact picker — only when no lead pre-selected */}
            {!selectedLeadId && (
              <div className="space-y-2">
                <Label>Select Contact</Label>
                <Select
                  value={sendFormData.leadId}
                  onValueChange={(value) => setSendFormData(prev => ({ ...prev, leadId: value as Id<"leads"> }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a contact..." />
                  </SelectTrigger>
                  <SelectContent>
                    {leads.map((lead: any) => (
                      <SelectItem key={lead._id} value={lead._id}>
                        {lead.name} — {lead.mobile}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Media URL input for IMAGE/DOCUMENT/VIDEO headers */}
            {needsMedia && (
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Upload className="h-3.5 w-3.5" />
                  {headerFormat} URL <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder={
                    headerFormat === "DOCUMENT"
                      ? "https://example.com/document.pdf"
                      : headerFormat === "IMAGE"
                      ? "https://example.com/image.jpg"
                      : "https://example.com/video.mp4"
                  }
                  value={sendFormData.mediaUrl}
                  onChange={(e) => setSendFormData(prev => ({ ...prev, mediaUrl: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  Must be a publicly accessible URL. For the MRP list, use:{" "}
                  <button
                    type="button"
                    className="text-primary underline text-xs"
                    onClick={() => setSendFormData(prev => ({
                      ...prev,
                      mediaUrl: "https://crm.skinticals.com/assets/Master_Cafoli_MRP_List_All_11032026.pdf"
                    }))}
                  >
                    Use MRP List PDF
                  </button>
                </p>
              </div>
            )}

            {/* Body variable inputs */}
            {bodyVariables.length > 0 && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">Template Variables</Label>
                {bodyVariables.map((varName) => (
                  <div key={varName} className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{`{{${varName}}}`}</Label>
                    <Input
                      placeholder={`Value for {{${varName}}}`}
                      value={sendFormData.variables[varName] || ""}
                      onChange={(e) => setSendFormData(prev => ({
                        ...prev,
                        variables: { ...prev.variables, [varName]: e.target.value }
                      }))}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Template preview */}
            {selectedTemplate && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Template Preview</Label>
                <div className="text-xs bg-muted/50 rounded p-3 space-y-1">
                  {selectedTemplate.components?.map((comp: any, idx: number) => (
                    <div key={idx}>
                      <span className="font-semibold">{comp.type}{comp.format ? ` (${comp.format})` : ""}: </span>
                      <span className="text-muted-foreground">{comp.text || "(media)"}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button onClick={handleSendTemplate} disabled={isSending} className="w-full">
              {isSending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <SendIcon className="h-4 w-4 mr-2" />
                  Send Template
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}