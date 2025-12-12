import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Plus, RefreshCw, CheckCircle, Clock, XCircle, Info } from "lucide-react";
import { useState } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function TemplatesDialog() {
  const [open, setOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const templates = useQuery(api.whatsappTemplatesQueries.getTemplates) || [];
  const syncTemplates = useAction(api.whatsappTemplates.syncTemplates);
  const createTemplate = useAction(api.whatsappTemplates.createTemplate);

  const [formData, setFormData] = useState({
    name: "",
    language: "en_US",
    category: "MARKETING",
    headerType: "TEXT",
    headerText: "",
    bodyText: "",
    footerText: "",
  });

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

  return (
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
                templates.map((template) => (
                  <div key={template._id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold">{template.name}</h4>
                        {getStatusIcon(template.status)}
                        <Badge variant={template.status === "APPROVED" ? "default" : "secondary"}>
                          {template.status}
                        </Badge>
                      </div>
                      <Badge variant="outline">{template.category}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">Language: {template.language}</p>
                    <div className="text-sm space-y-1">
                      {template.components.map((comp, idx) => (
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
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => insertFormatting("bold")}
                    title="Bold"
                  >
                    <strong>B</strong>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => insertFormatting("italic")}
                    title="Italic"
                  >
                    <em>I</em>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => insertFormatting("strikethrough")}
                    title="Strikethrough"
                  >
                    <s>S</s>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => insertFormatting("monospace")}
                    title="Monospace"
                  >
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
  );
}