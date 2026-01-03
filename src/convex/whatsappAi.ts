"use node";
import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

export const generateAndSendAiReply = action({
  args: {
    leadId: v.id("leads"),
    phoneNumber: v.string(),
    userId: v.id("users"),
    replyingToMessageId: v.optional(v.id("messages")),
    replyingToExternalId: v.optional(v.string()),
    context: v.any(),
    prompt: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<string> => {
    // 1. Generate content using the AI service (which handles model selection/fallback)
    const aiResponse = (await ctx.runAction(api.ai.generateContent, {
      prompt: args.prompt || "Draft a reply to this conversation",
      type: "chat_reply",
      context: args.context,
      userId: args.userId,
      leadId: args.leadId,
    })) as string;

    if (!aiResponse) {
      throw new Error("AI failed to generate a response");
    }

    // 2. Send message immediately via WhatsApp
    await ctx.runAction(api.whatsapp.sendWhatsAppMessage, {
      phoneNumber: args.phoneNumber,
      message: aiResponse,
      leadId: args.leadId,
      quotedMessageId: args.replyingToMessageId,
      quotedMessageExternalId: args.replyingToExternalId,
    });

    return aiResponse;
  },
});