"use node";
import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

export const sendEmail = action({
  args: {
    senderPrefix: v.string(), // The part before @mail.cafoli.in
    to: v.string(),
    subject: v.string(),
    htmlContent: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string; messageId?: string }> => {
    // 1. Get an active API key (using the existing logic in brevo.ts if possible, or re-implementing rotation here)
    // Since brevo.ts might be complex, I'll use a simple rotation here by calling the internal query to get keys
    
    // Explicitly typing keys as any to avoid circular inference issues with internal
    const keys: any = await ctx.runQuery(internal.brevoQueries.getActiveKeys, {});
    
    if (!keys || keys.length === 0) {
      return { success: false, error: "No active Brevo API keys found" };
    }

    // Simple rotation: pick the one with least usage or just the first one that hasn't hit limit
    // For now, just pick the first one
    const apiKey = keys[0];

    const senderEmail = `${args.senderPrefix}@mail.cafoli.in`;

    try {
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "accept": "application/json",
          "api-key": apiKey.apiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          sender: { email: senderEmail, name: args.senderPrefix },
          to: [{ email: args.to }],
          subject: args.subject,
          htmlContent: args.htmlContent,
        }),
      });

      const data: any = await response.json();

      if (!response.ok) {
        return { success: false, error: data.message || "Failed to send email" };
      }

      // Increment usage
      await ctx.runMutation(internal.brevoQueries.incrementUsage, { keyId: apiKey._id });

      return { success: true, messageId: data.messageId };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  },
});