import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const logAiGeneration = internalMutation({
  args: {
    userId: v.id("users"),
    leadId: v.optional(v.id("leads")),
    type: v.string(),
    content: v.string(),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("aiSuggestions", {
      userId: args.userId,
      leadId: args.leadId,
      type: args.type,
      content: args.content,
      status: args.status,
    });
    
    // Also log to activity logs
    await ctx.db.insert("activityLogs", {
        userId: args.userId,
        leadId: args.leadId,
        category: "AI: Assistance",
        action: "Generated Content",
        details: `Generated ${args.type}`,
        timestamp: Date.now(),
    });
  },
});
