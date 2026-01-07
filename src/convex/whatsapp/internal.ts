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
  handler: async (ctx, args): Promise<{ success: boolean; messageId?: string }> => {
    // Delegate to the robust implementation in messages.ts
    const result = await ctx.runAction(internal.whatsapp.messages.sendMedia, args);
    
    if (!result) {
      throw new Error("Failed to send media: No response from internal action");
    }

    return {
      success: result.success,
      messageId: result.messageId as string | undefined
    };
  },
});