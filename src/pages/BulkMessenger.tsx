import { useState, useEffect, useRef } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAction, useQuery, usePaginatedQuery, useMutation } from "convex/react";
import { getConvexApi } from "@/lib/convex-api";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Upload, Send, FileText, AlertCircle, Users, CheckCircle2, XCircle, RefreshCw, Search, ArrowLeft, Check, CheckCheck, MessageSquare } from "lucide-react";
import Papa from "papaparse";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Id } from "@/convex/_generated/dataModel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const api = getConvexApi() as any;

function getStatusIcon(status?: string | null) {
  switch (status) {
    case "sent":
      return <Check className="h-3 w-3 inline ml-1 text-muted-foreground" />;
    case "delivered":
      return <CheckCheck className="h-3 w-3 inline ml-1 text-muted-foreground" />;
    case "read":
      return <CheckCheck className="h-3 w-3 inline ml-1 text-blue-500" />;
    default:
      return null;
  }
}

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

function formatTime(ts: number) {
  const d = new Date(ts);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString();
}

// Chat view for a selected bulk contact
function BulkChatWindow({ contact, onBack }: { contact: any; onBack: () => void }) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const { results: messagesResult, status, loadMore } = usePaginatedQuery(
    api.whatsappQueries.getChatMessages,
    contact.leadId ? { leadId: contact.leadId as Id<"leads"> } : "skip",
    { initialNumItems: 100 }
  );

  const messages = messagesResult ? [...messagesResult].reverse() : [];
  const canLoadMore = status === "CanLoadMore";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const loadMoreRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && canLoadMore) loadMore(50);
      },
      { threshold: 0.5, root: messagesContainerRef.current }
    );
    const el = loadMoreRef.current;
    if (el) observer.observe(el);
    return () => { if (el) observer.unobserve(el); };
  }, [canLoadMore, loadMore]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="h-16 border-b flex items-center gap-3 px-4 bg-background flex-shrink-0">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Avatar className="h-10 w-10">
          <AvatarFallback className="bg-primary/10 text-primary font-medium text-sm">
            {getInitials(contact.displayName || contact.phoneNumber)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate">{contact.displayName || contact.phoneNumber}</div>
          <div className="text-xs text-muted-foreground">{contact.phoneNumber}</div>
        </div>
        <Badge variant="outline" className="text-xs shrink-0">
          <MessageSquare className="h-3 w-3 mr-1" />
          Bulk Campaign
        </Badge>
        <div className="text-xs text-muted-foreground shrink-0">
          Template: <span className="font-medium">{contact.templateId}</span>
        </div>
      </div>

      {/* Messages */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-2 bg-muted/5">
        {canLoadMore && (
          <div ref={loadMoreRef} className="flex justify-center py-2">
            <Button variant="ghost" size="sm" onClick={() => loadMore(50)}>Load older messages</Button>
          </div>
        )}

        {!contact.leadId && (
          <div className="flex justify-center py-8">
            <div className="text-center text-muted-foreground">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No chat yet. Message was sent via template.</p>
              <p className="text-xs mt-1">Sent: {new Date(contact.sentAt).toLocaleString()}</p>
              <div className="mt-2 flex items-center justify-center gap-1 text-xs">
                <span>Status:</span>
                {getStatusIcon(contact.lastMessageStatus)}
                <span className="capitalize">{contact.lastMessageStatus || "sent"}</span>
              </div>
            </div>
          </div>
        )}

        {messages.map((msg: any) => {
          const isOutbound = msg.direction === "outbound";
          return (
            <div key={msg._id} className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}>
              <div className={`rounded-2xl px-3.5 py-2 shadow-sm max-w-[75%] ${
                isOutbound ? "bg-[#d9fdd3] rounded-br-sm" : "bg-white rounded-bl-sm"
              }`}>
                <p className="text-sm text-gray-900 whitespace-pre-wrap break-words">{msg.content}</p>
                <div className="text-[10px] mt-1 text-gray-500 text-right flex items-center justify-end gap-1 font-medium">
                  {formatTime(msg._creationTime)}
                  {isOutbound && getStatusIcon(msg.status)}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Footer - read only, no reply since it's bulk */}
      <div className="border-t p-3 bg-background flex-shrink-0">
        <p className="text-xs text-center text-muted-foreground">
          This is a bulk campaign contact. When they reply, they will appear in the WhatsApp inbox.
        </p>
      </div>
    </div>
  );
}

export default function BulkMessenger() {
  const { user } = useAuth();
  const [csvData, setCsvData] = useState<any[]>([]);
  const [mapping, setMapping] = useState({ phone: "", name: "" });
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processId, setProcessId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContact, setSelectedContact] = useState<any | null>(null);
  const [showSendDialog, setShowSendDialog] = useState(false);

  const templates = useQuery(api.whatsappTemplatesQueries.getTemplates) ?? [];
  const sendBulk = useAction(api.whatsappBulk.sendBulkTemplateMessages);
  const batchStatus = useQuery(api.bulkMessaging.getBatchStatus, processId ? { processId } : "skip");
  const syncTemplates = useAction(api.whatsappTemplates.syncTemplates);

  // Bulk messaging contacts (status "sent" - not yet replied)
  const bulkContacts = useQuery(api.whatsappQueries.getBulkMessagingContacts, { searchQuery: searchQuery || undefined }) ?? [];

  useEffect(() => {
    if (batchStatus?.status === "completed" && isProcessing) {
      setIsProcessing(false);
      toast.success("Completed sending bulk messages!");
    }
  }, [batchStatus]);

  const handleSyncTemplates = async () => {
    setIsSyncing(true);
    try {
      const result = await syncTemplates();
      toast.success(`Successfully synced ${result.count} templates`);
    } catch (error: any) {
      toast.error(error.message || "Failed to sync templates");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setCsvData(results.data as any[]);
        setProcessId(null);
        toast.success(`Loaded ${results.data.length} contacts from CSV`);
        const headers = results.meta.fields || [];
        const phoneHeader = headers.find(h => /phone|mobile|number|tel/i.test(h));
        const nameHeader = headers.find(h => /name|contact|customer/i.test(h));
        setMapping({ phone: phoneHeader || "", name: nameHeader || "" });
      }
    });
  };

  const handleSendBulk = async () => {
    if (!user || !selectedTemplate || csvData.length === 0 || !mapping.phone) {
      toast.error("Please fill all required fields and map the phone column");
      return;
    }
    setIsProcessing(true);
    setProcessId(null);
    try {
      const contacts = csvData
        .map(row => ({
          phoneNumber: String(row[mapping.phone] || "").replace(/\D/g, ""),
          name: (mapping.name && mapping.name !== "__none__") ? String(row[mapping.name] || "") : undefined,
        }))
        .filter(c => c.phoneNumber.length >= 7);

      if (contacts.length === 0) {
        toast.error("No valid phone numbers found in the selected column");
        setIsProcessing(false);
        return;
      }

      const [templateName, templateLanguage] = selectedTemplate.split("|");
      const result = await sendBulk({ contacts, templateName, templateLanguage, adminId: user._id });
      setProcessId(result.processId);
      setShowSendDialog(false);
      toast.success(`Started sending messages to ${result.total} contacts in the background.`);
    } catch (error: any) {
      toast.error(error?.message || "Failed to start bulk messages");
      setIsProcessing(false);
    }
  };

  if (user?.role !== "admin") {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <h1 className="text-2xl font-bold">Unauthorized</h1>
          <p className="text-muted-foreground">Only admins can access bulk messaging.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-4rem)] bg-background overflow-hidden">
        {/* Left Sidebar - Contact List */}
        <div className={`w-full md:w-[350px] flex-shrink-0 border-r flex-col bg-muted/10 ${selectedContact ? 'hidden md:flex' : 'flex'}`}>
          {/* Header */}
          <div className="h-16 border-b flex items-center justify-between px-4 bg-background">
            <h1 className="text-xl font-semibold">Bulk Campaigns</h1>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={() => setShowSendDialog(true)} title="New Bulk Send">
                <Send className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleSyncTemplates} disabled={isSyncing} title="Sync Templates">
                <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>

          {/* Search */}
          <div className="p-3 border-b bg-background">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search contacts..."
                className="pl-9 bg-muted/50 border-none focus-visible:ring-1"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Stats bar */}
          <div className="px-4 py-2 border-b bg-background/50 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {bulkContacts.length} awaiting reply
            </span>
            {batchStatus?.status === "processing" && (
              <span className="flex items-center gap-1 text-blue-500">
                <RefreshCw className="h-3 w-3 animate-spin" />
                Sending {batchStatus.processed}/{batchStatus.total}
              </span>
            )}
          </div>

          {/* Contact list */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {bulkContacts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-12">
                <MessageSquare className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm font-medium">No bulk contacts</p>
                <p className="text-xs mt-1">Send a bulk campaign to see contacts here</p>
                <Button variant="outline" size="sm" className="mt-4 gap-2" onClick={() => setShowSendDialog(true)}>
                  <Send className="h-3 w-3" />
                  New Campaign
                </Button>
              </div>
            ) : (
              <div className="space-y-0.5 p-2">
                {bulkContacts.map((contact: any) => (
                  <div
                    key={contact._id}
                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200 hover:bg-accent/60 ${
                      selectedContact?._id === contact._id ? "bg-accent shadow-sm" : ""
                    }`}
                    onClick={() => setSelectedContact(contact)}
                  >
                    <div className="relative">
                      <Avatar className="h-12 w-12 border border-background shadow-sm">
                        <AvatarFallback className="bg-primary/10 text-primary font-medium">
                          {getInitials(contact.displayName || contact.phoneNumber)}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-0.5">
                        <div className="font-semibold truncate text-sm">{contact.displayName || contact.phoneNumber}</div>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2 font-medium">
                          {formatTime(contact.lastMessageAt || contact.sentAt)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
                          {contact.phoneNumber}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {getStatusIcon(contact.lastMessageStatus)}
                          <span className="text-[10px] text-muted-foreground capitalize">
                            {contact.lastMessageStatus || "sent"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Main Chat Area */}
        <div className={`flex-1 min-w-0 bg-background flex-col ${selectedContact ? 'flex' : 'hidden md:flex'}`}>
          {selectedContact ? (
            <BulkChatWindow contact={selectedContact} onBack={() => setSelectedContact(null)} />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center bg-muted/5">
              <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                <MessageSquare className="h-10 w-10 text-primary/40" />
              </div>
              <h2 className="text-2xl font-semibold mb-2">Bulk Campaigns</h2>
              <p className="text-muted-foreground max-w-md text-center mb-6">
                View all bulk campaign contacts and their message status. When a contact replies, they move to the WhatsApp inbox.
              </p>
              <Button className="gap-2" onClick={() => setShowSendDialog(true)}>
                <Send className="h-4 w-4" />
                New Bulk Campaign
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Send Campaign Dialog */}
      <Dialog open={showSendDialog} onOpenChange={setShowSendDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              New Bulk Campaign
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* CSV Upload */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">1. Upload Contacts CSV</Label>
              <Input type="file" accept=".csv" onChange={handleFileUpload} />
              {csvData.length > 0 && (
                <p className="text-xs text-green-600 font-medium">{csvData.length} contacts loaded</p>
              )}
            </div>

            {csvData.length > 0 && csvData[0] && (
              <div className="space-y-3">
                <Label className="text-sm font-semibold">2. Map Columns</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Phone Number Column *</Label>
                    <Select value={mapping.phone} onValueChange={(v) => setMapping({ ...mapping, phone: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select column" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.keys(csvData[0]).map(header => (
                          <SelectItem key={header} value={header}>{header}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Name Column (Optional)</Label>
                    <Select value={mapping.name || "__none__"} onValueChange={(v) => setMapping({ ...mapping, name: v === "__none__" ? "" : v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select column" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {Object.keys(csvData[0]).map(header => (
                          <SelectItem key={header} value={header}>{header}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {/* Template Selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">3. Select Template</Label>
                <Button variant="ghost" size="sm" onClick={handleSyncTemplates} disabled={isSyncing} className="gap-1 h-7 text-xs">
                  <RefreshCw className={`h-3 w-3 ${isSyncing ? "animate-spin" : ""}`} />
                  Sync
                </Button>
              </div>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.length === 0 ? (
                    <SelectItem value="no_templates" disabled>No templates available</SelectItem>
                  ) : (
                    templates.map((t: any) => (
                      <SelectItem key={t._id} value={`${t.name}|${t.language}`}>
                        {t.name} ({t.language})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Summary */}
            <div className="bg-muted rounded-lg p-4">
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="text-center">
                  <p className="text-2xl font-bold">{csvData.length}</p>
                  <p className="text-xs text-muted-foreground">Contacts</p>
                </div>
                <div className="text-center">
                  <p className={`text-sm font-semibold ${mapping.phone ? "text-green-600" : "text-destructive"}`}>
                    {mapping.phone ? "Ready" : "Missing"}
                  </p>
                  <p className="text-xs text-muted-foreground">Phone Column</p>
                </div>
                <div className="text-center">
                  <p className={`text-sm font-semibold ${selectedTemplate ? "text-green-600" : "text-destructive"}`}>
                    {selectedTemplate ? "Selected" : "None"}
                  </p>
                  <p className="text-xs text-muted-foreground">Template</p>
                </div>
              </div>
            </div>

            {/* Progress */}
            {batchStatus && (
              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2 font-semibold text-sm">
                  {batchStatus.status === "processing" ? (
                    <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  )}
                  {batchStatus.status === "processing" ? "Sending..." : "Complete"}
                </div>
                <Progress value={((batchStatus.processed || 0) + (batchStatus.failed || 0)) / (batchStatus.total || 1) * 100} className="h-2" />
                <div className="flex gap-4 text-xs">
                  <span className="text-green-600 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />{batchStatus.processed || 0} sent</span>
                  <span className="text-destructive flex items-center gap-1"><XCircle className="h-3 w-3" />{batchStatus.failed || 0} failed</span>
                  <span className="text-muted-foreground">{batchStatus.total || 0} total</span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSendDialog(false)}>Cancel</Button>
            <Button
              className="gap-2"
              disabled={isProcessing || !mapping.phone || !selectedTemplate || csvData.length === 0}
              onClick={handleSendBulk}
            >
              <Send className="h-4 w-4" />
              {isProcessing ? "Sending..." : `Send to ${csvData.length} Contacts`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}