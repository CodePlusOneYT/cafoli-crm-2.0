import { TemplatesDialog } from "@/components/TemplatesDialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useAction, useMutation, useQuery } from "convex/react";
import { Check, CheckCheck, MessageSquare, MoreVertical, Paperclip, Phone, Reply, Send, Smile, Video, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface ChatWindowProps {
  selectedLeadId: Id<"leads">;
  selectedLead: any;
}

export function ChatWindow({ selectedLeadId, selectedLead }: ChatWindowProps) {
  const messages = useQuery(api.whatsappQueries.getChatMessages, { leadId: selectedLeadId }) || [];
  
  const sendWhatsAppMessage = useAction(api.whatsapp.sendWhatsAppMessage);
  const sendWhatsAppMedia = useAction(api.whatsapp.sendWhatsAppMedia);
  const generateUploadUrl = useMutation(api.whatsappStorage.generateUploadUrl);
  const markChatAsRead = useMutation(api.whatsappMutations.markChatAsRead);

  const [whatsappMessage, setWhatsappMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [replyingTo, setReplyingTo] = useState<any>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, replyingTo]);

  // Mark as read when selecting a lead
  useEffect(() => {
    if (selectedLeadId && (selectedLead?.unreadCount ?? 0) > 0) {
      markChatAsRead({ leadId: selectedLeadId });
    }
  }, [selectedLeadId, selectedLead?.unreadCount, markChatAsRead]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 16 * 1024 * 1024) {
        toast.error("File size must be less than 16MB");
        return;
      }
      setSelectedFile(file);
      toast.success(`Selected: ${file.name}`);
    }
  };

  const handleSendWhatsApp = async () => {
    if (!selectedLead) {
      toast.error("Please select a contact");
      return;
    }

    if (selectedFile) {
      setIsUploading(true);
      setIsSending(true);
      try {
        const uploadUrl = await generateUploadUrl();
        const result = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": selectedFile.type },
          body: selectedFile,
        });
        
        const { storageId } = await result.json();
        
        await sendWhatsAppMedia({
          phoneNumber: selectedLead.mobile,
          message: whatsappMessage.trim() || undefined,
          leadId: selectedLead._id,
          storageId,
          fileName: selectedFile.name,
          mimeType: selectedFile.type,
        });
        
        setWhatsappMessage("");
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        toast.success("Media sent successfully");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to send media");
      } finally {
        setIsUploading(false);
        setIsSending(false);
      }
      return;
    }

    if (!whatsappMessage.trim()) {
      toast.error("Please enter a message");
      return;
    }
    
    setIsSending(true);
    try {
      await sendWhatsAppMessage({
        phoneNumber: selectedLead.mobile,
        message: whatsappMessage,
        leadId: selectedLead._id,
        quotedMessageId: replyingTo?._id,
        quotedMessageExternalId: replyingTo?.externalId,
      });
      setWhatsappMessage("");
      setReplyingTo(null);
      toast.success("Message sent");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendWhatsApp();
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-US", { 
      hour: "2-digit", 
      minute: "2-digit",
      hour12: true 
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "sent":
        return <Check className="h-3 w-3 inline ml-1 text-gray-500" />;
      case "delivered":
        return <CheckCheck className="h-3 w-3 inline ml-1 text-gray-500" />;
      case "read":
        return <CheckCheck className="h-3 w-3 inline ml-1 text-blue-500" />;
      default:
        return null;
    }
  };

  const renderMessageContent = (message: any) => {
    if (message.messageType === "image" && message.mediaUrl) {
      return (
        <div className="space-y-2">
          <img 
            src={message.mediaUrl} 
            alt={message.mediaName || "Image"} 
            className="rounded-lg max-w-full h-auto max-h-64 object-cover"
          />
          {message.content && <p className="text-sm text-gray-900">{message.content}</p>}
        </div>
      );
    }
    
    if (message.messageType === "file" && message.mediaUrl) {
      return (
        <div className="space-y-2">
          <a 
            href={message.mediaUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-2 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
          >
            <Paperclip className="h-4 w-4" />
            <span className="text-sm font-medium">{message.mediaName || "File"}</span>
          </a>
          {message.content && <p className="text-sm text-gray-900">{message.content}</p>}
        </div>
      );
    }
    
    return <p className="text-sm text-gray-900 whitespace-pre-wrap break-words">{message.content}</p>;
  };

  return (
    <Card className="flex flex-col h-full overflow-hidden">
      <CardHeader className="border-b py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary/10 text-primary">
                {getInitials(selectedLead.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="font-semibold">{selectedLead.name}</div>
              <div className="text-xs text-muted-foreground">{selectedLead.mobile}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <Phone className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <Video className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <div className="flex-1 overflow-y-auto p-4 bg-[#efeae2] relative min-h-0">
        <div 
          className="absolute inset-0 opacity-[0.06]" 
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            backgroundSize: '60px 60px'
          }}
        />
        <div className="space-y-4 relative z-10">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <MessageSquare className="h-16 w-16 text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">No messages yet</p>
              <p className="text-sm text-muted-foreground">Send a message to start the conversation</p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message._id}
                className={`flex ${message.direction === "outbound" ? "justify-end" : "justify-start"} group`}
              >
                <div className="flex items-end gap-2 max-w-[70%]">
                  {message.direction === "inbound" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => setReplyingTo(message)}
                      title="Reply"
                    >
                      <Reply className="h-3 w-3" />
                    </Button>
                  )}
                  <div
                    className={`rounded-lg px-3 py-2 shadow-sm w-full ${
                      message.direction === "outbound"
                        ? "bg-[#d9fdd3]"
                        : "bg-white"
                    }`}
                  >
                    {message.quotedMessage && (
                      <div className="mb-2 p-2 bg-black/5 rounded border-l-4 border-primary/50 text-xs">
                        <p className="font-semibold text-primary/80">
                          {message.quotedMessage.direction === "outbound" ? "You" : selectedLead.name}
                        </p>
                        <p className="truncate opacity-70">{message.quotedMessage.content || "Media"}</p>
                      </div>
                    )}
                    {renderMessageContent(message)}
                    <div className="text-[11px] mt-1 text-gray-500 text-right flex items-center justify-end gap-1">
                      {formatTime(message._creationTime)}
                      {message.direction === "outbound" && getStatusIcon(message.status)}
                    </div>
                  </div>
                  {message.direction === "outbound" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => setReplyingTo(message)}
                      title="Reply"
                    >
                      <Reply className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="border-t p-4 flex-shrink-0 bg-background">
        {replyingTo && (
          <div className="mb-2 flex items-center gap-2 p-2 bg-muted rounded-lg border-l-4 border-primary">
            <div className="flex-1 overflow-hidden">
              <p className="text-xs font-semibold text-primary">
                Replying to {replyingTo.direction === "outbound" ? "yourself" : selectedLead.name}
              </p>
              <p className="text-sm truncate text-muted-foreground">
                {replyingTo.content || (replyingTo.mediaName ? "File/Media" : "Message")}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setReplyingTo(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
        
        {selectedFile && (
          <div className="mb-2 flex items-center gap-2 p-2 bg-muted rounded-lg">
            <Paperclip className="h-4 w-4" />
            <span className="text-sm flex-1 truncate">{selectedFile.name}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedFile(null);
                if (fileInputRef.current) {
                  fileInputRef.current.value = "";
                }
              }}
            >
              Remove
            </Button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileSelect}
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
          />
          <Button 
            variant="ghost" 
            size="icon"
            className="h-10 w-10 text-muted-foreground hover:text-foreground"
            title="Attach file"
            onClick={() => fileInputRef.current?.click()}
            disabled={isSending || isUploading}
          >
            <Paperclip className="h-5 w-5" />
          </Button>
          <TemplatesDialog selectedLeadId={selectedLeadId} />
          <div className="flex-1 relative">
            <Input
              placeholder="Type a message..."
              value={whatsappMessage}
              onChange={(e) => setWhatsappMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              className="pr-10"
              disabled={isSending || isUploading}
            />
            <Button 
              variant="ghost" 
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-foreground"
              title="Add emoji"
            >
              <Smile className="h-5 w-5" />
            </Button>
          </div>
          <Button 
            onClick={handleSendWhatsApp} 
            disabled={isSending || isUploading || (!whatsappMessage.trim() && !selectedFile)}
            size="icon"
            className="h-10 w-10"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
