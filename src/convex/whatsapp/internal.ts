"use node";

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";

// Helper to validate and retrieve WhatsApp credentials
function getWhatsAppCredentials(): { accessToken: string; phoneNumberId: string } {
  const accessToken = process.env.CLOUD_API_ACCESS_TOKEN;
  const phoneNumberId = process.env.WA_PHONE_NUMBER_ID;
  
  if (!accessToken || !phoneNumberId) {
    const missing = [];
    if (!accessToken) missing.push("CLOUD_API_ACCESS_TOKEN");
    if (!phoneNumberId) missing.push("WA_PHONE_NUMBER_ID");
    
    throw new Error(
      `WhatsApp API not configured. Missing environment variables: ${missing.join(", ")}. ` +
      `Please set these in the Convex dashboard under Settings > Environment Variables.`
    );
  }
  
  return { accessToken, phoneNumberId };
}

// Send welcome message to new WhatsApp leads
export const sendWelcomeMessage = internalAction({
  args: {
    leadId: v.id("leads"),
    phoneNumber: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const { accessToken, phoneNumberId } = getWhatsAppCredentials();
      
      const welcomeMessage = "Thank you for contacting us! We've received your message and will get back to you shortly. 🙏";

      const response = await fetch(
        `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: args.phoneNumber,
            type: "text",
            text: { body: welcomeMessage },
          }),
        }
      );

      const data = await response.json();
      
      if (!response.ok) {
        console.error("[WELCOME_MSG] WhatsApp API error:", JSON.stringify(data));
        throw new Error(`WhatsApp API error: ${JSON.stringify(data)}`);
      }

      // Store welcome message in database
      await ctx.runMutation("whatsappMutations:storeMessage" as any, {
        leadId: args.leadId,
        phoneNumber: args.phoneNumber,
        content: welcomeMessage,
        direction: "outbound",
        status: "sent",
        externalId: data.messages?.[0]?.id || "",
      });

      console.log(`[WELCOME_MSG] Sent to ${args.phoneNumber}`);
    } catch (error) {
      console.error("[WELCOME_MSG] Error:", error);
      
      // Log failure to activity logs
      await ctx.runMutation(internal.activityLogs.logActivity, {
        category: "WhatsApp: Message Going",
        action: "Welcome Message Failed",
        details: `Failed to send welcome message to ${args.phoneNumber}`,
        metadata: { error: error instanceof Error ? error.message : String(error) },
        leadId: args.leadId,
      });
      
      throw error;
    }
  },
});

export const sendMessage = internalAction({
  args: {
    phoneNumber: v.string(),
    message: v.string(),
    leadId: v.id("leads"),
    quotedMessageId: v.optional(v.id("messages")),
    quotedMessageExternalId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    try {
      const { accessToken, phoneNumberId } = getWhatsAppCredentials();
      
      // Clean phone number (remove spaces, dashes, but keep + if present)
      const cleanedPhone = args.phoneNumber.replace(/[\s-]/g, "");
      
      // Prepare message payload
      const payload: any = {
        messaging_product: "whatsapp",
        to: cleanedPhone,
        type: "text",
        text: { body: args.message },
      };

      // Add context for reply if quoted
      if (args.quotedMessageExternalId) {
        payload.context = {
          message_id: args.quotedMessageExternalId
        };
      }

      // Send message via WhatsApp Cloud API
      const response = await fetch(
        `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();
      
      if (!response.ok) {
        console.error("[SEND_MSG] WhatsApp API error:", JSON.stringify(data));
        
        // Log failure
        await ctx.runMutation(internal.activityLogs.logActivity, {
          category: "WhatsApp: Message Going",
          action: "Message Send Failed",
          details: `Failed to send message to ${args.phoneNumber}`,
          metadata: { error: data, message: args.message },
          leadId: args.leadId,
        });
        
        return { success: false, error: `WhatsApp API error: ${JSON.stringify(data)}` };
      }

      // Store message in database
      await ctx.runMutation("whatsappMutations:storeMessage" as any, {
        leadId: args.leadId,
        phoneNumber: args.phoneNumber,
        content: args.message,
        direction: "outbound",
        status: "sent",
        externalId: data.messages?.[0]?.id || "",
        quotedMessageId: args.quotedMessageId,
      });

      return { success: true, messageId: data.messages?.[0]?.id };
    } catch (error) {
      console.error("[SEND_MSG] Error:", error);
      
      // Log failure
      await ctx.runMutation(internal.activityLogs.logActivity, {
        category: "WhatsApp: Message Going",
        action: "Message Send Error",
        details: `Error sending message to ${args.phoneNumber}`,
        metadata: { error: error instanceof Error ? error.message : String(error) },
        leadId: args.leadId,
      });
      
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  },
});

export const sendMedia = internalAction({
  args: {
    phoneNumber: v.string(),
    message: v.optional(v.string()),
    leadId: v.id("leads"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    mimeType: v.string(),
  },
  handler: async (ctx, args) => {
    console.log(`[SEND_MEDIA] Starting for ${args.fileName} (${args.mimeType}) to ${args.phoneNumber}`);
    
    try {
      const { accessToken, phoneNumberId } = getWhatsAppCredentials();
      
      // Step 1: Get file directly from Convex storage
      console.log(`[SEND_MEDIA] Fetching file from storage: ${args.storageId}`);
      const fileBlob = await ctx.storage.get(args.storageId);
      
      if (!fileBlob) {
        console.error(`[SEND_MEDIA] File not found in storage: ${args.storageId}`);
        throw new Error(`File not found in storage: ${args.storageId}`);
      }
      
      console.log(`[SEND_MEDIA] File retrieved, size: ${fileBlob.size} bytes`);

      // Step 2: Upload to WhatsApp's media API
      console.log(`[SEND_MEDIA] Uploading to WhatsApp media API...`);
      const formData = new FormData();
      formData.append("file", fileBlob, args.fileName);
      formData.append("messaging_product", "whatsapp");

      const uploadResponse = await fetch(
        `https://graph.facebook.com/v20.0/${phoneNumberId}/media`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
          },
          body: formData,
        }
      );

      const uploadData = await uploadResponse.json();
      console.log(`[SEND_MEDIA] Upload response:`, JSON.stringify(uploadData, null, 2));
      
      if (!uploadResponse.ok) {
        console.error(`[SEND_MEDIA] Upload failed:`, JSON.stringify(uploadData));
        
        // Log failure
        await ctx.runMutation(internal.activityLogs.logActivity, {
          category: "WhatsApp: Message Going",
          action: "Media Upload Failed",
          details: `Failed to upload ${args.fileName} to WhatsApp`,
          metadata: { 
            storageId: args.storageId,
            mimeType: args.mimeType,
            error: uploadData 
          },
          leadId: args.leadId,
        });
        
        throw new Error(`WhatsApp media upload error: ${JSON.stringify(uploadData)}`);
      }

      const mediaId = uploadData.id;
      if (!mediaId) {
        throw new Error("WhatsApp did not return a media ID");
      }
      console.log(`[SEND_MEDIA] Media uploaded, ID: ${mediaId}`);

      // Step 3: Determine message type based on MIME type
      let mediaType: string;
      if (args.mimeType.startsWith("image/")) {
        mediaType = "image";
      } else if (args.mimeType.startsWith("video/")) {
        mediaType = "video";
      } else if (args.mimeType.startsWith("audio/")) {
        mediaType = "audio";
      } else {
        mediaType = "document";
      }
      
      console.log(`[SEND_MEDIA] Sending as type: ${mediaType}`);

      // Step 4: Send message with media
      const messagePayload: any = {
        messaging_product: "whatsapp",
        to: args.phoneNumber,
        type: mediaType,
        [mediaType]: {
          id: mediaId,
        },
      };

      // Add caption if provided
      if (args.message) {
        messagePayload[mediaType].caption = args.message;
      }

      // Add filename for documents
      if (mediaType === "document") {
        messagePayload[mediaType].filename = args.fileName;
      }

      const response = await fetch(
        `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(messagePayload),
        }
      );

      const data = await response.json();
      console.log(`[SEND_MEDIA] Send response (${response.status}):`, JSON.stringify(data, null, 2));
      
      if (!response.ok) {
        console.error(`[SEND_MEDIA] Send failed:`, JSON.stringify(data));
        
        // Log failure
        await ctx.runMutation(internal.activityLogs.logActivity, {
          category: "WhatsApp: Message Going",
          action: "Media Send Failed",
          details: `Failed to send ${args.fileName} via WhatsApp`,
          metadata: { 
            storageId: args.storageId,
            mimeType: args.mimeType,
            mediaType,
            error: data 
          },
          leadId: args.leadId,
        });
        
        throw new Error(`WhatsApp API error: ${JSON.stringify(data)}`);
      }

      // Get file URL for database record
      const fileUrl = await ctx.storage.getUrl(args.storageId);

      // Store in database
      await ctx.runMutation("whatsappMutations:storeMessage" as any, {
        leadId: args.leadId,
        phoneNumber: args.phoneNumber,
        content: args.message || "",
        direction: "outbound",
        status: "sent",
        externalId: data.messages?.[0]?.id || "",
        messageType: mediaType,
        mediaUrl: fileUrl,
        mediaName: args.fileName,
        mediaMimeType: args.mimeType,
      });

      console.log(`[SEND_MEDIA] Success! Message ID: ${data.messages?.[0]?.id}`);
      return { success: true, messageId: data.messages?.[0]?.id };
      
    } catch (error) {
      console.error("[SEND_MEDIA] ERROR:", error);
      
      // Log failure
      await ctx.runMutation(internal.activityLogs.logActivity, {
        category: "WhatsApp: Message Going",
        action: "Media Send Error",
        details: `Error sending media ${args.fileName}`,
        metadata: { 
          storageId: args.storageId,
          mimeType: args.mimeType,
          error: error instanceof Error ? error.message : String(error) 
        },
        leadId: args.leadId,
      });
      
      throw error;
    }
  },
});