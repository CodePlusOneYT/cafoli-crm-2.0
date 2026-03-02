import { v } from "convex/values";
import { action } from "../_generated/server";
import { api } from "../_generated/api";

export const handleIncomingMessage = action({
  args: { 
    phoneNumber: v.string(), 
    message: v.string(),
    messageId: v.string() 
  },
  handler: async (ctx, args) => {
    // 1. Check if it's a reply to a bulk campaign
    // We check if the mutation exists before calling to avoid runtime errors if file is missing
    // @ts-ignore
    const bulkMessagingApi = (api as any).bulkMessaging;
    if (bulkMessagingApi && bulkMessagingApi.processReply) {
      await ctx.runMutation(bulkMessagingApi.processReply, {
        phoneNumber: args.phoneNumber,
        message: args.message
      });
    }

    // 2. Standard message handling logic...
  }
});