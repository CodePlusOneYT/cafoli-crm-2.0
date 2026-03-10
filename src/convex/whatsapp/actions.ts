import { v } from "convex/values";
import { action } from "../_generated/server";

// Placeholder for future public WhatsApp actions
// Incoming message processing is handled server-side via webhook.ts
export const handleIncomingMessage = action({
  args: { 
    phoneNumber: v.string(), 
    message: v.string(),
    messageId: v.string() 
  },
  handler: async (_ctx, _args) => {
    // Incoming messages are processed via the HTTP webhook endpoint
    // See: convex/whatsapp/webhook.ts
    return { success: true };
  }
});