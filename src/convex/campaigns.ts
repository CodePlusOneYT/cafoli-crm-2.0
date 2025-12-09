import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getCampaigns = query({
  args: { userId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    const userId = args.userId || await getAuthUserId(ctx);
    if (!userId) return [];
    
    // Limit to recent campaigns for faster loading
    return await ctx.db.query("campaigns").order("desc").take(50);
  },
});

export const createCampaign = mutation({
  args: {
    name: v.string(),
    type: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const userId = args.userId;
    if (!userId) throw new Error("Unauthorized");
    
    return await ctx.db.insert("campaigns", {
      name: args.name,
      type: args.type,
      status: "Draft",
      metrics: {
        sent: 0,
        opened: 0,
        clicked: 0,
      },
    });
  },
});