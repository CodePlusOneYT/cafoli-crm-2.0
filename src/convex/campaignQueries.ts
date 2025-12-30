import { v } from "convex/values";
import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { ROLES } from "./schema";

export const getCampaigns = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const user = await ctx.db.get(userId);
    const isAdmin = user?.role === ROLES.ADMIN;

    if (isAdmin) {
      return await ctx.db.query("campaigns").order("desc").collect();
    } else {
      return await ctx.db.query("campaigns")
        .withIndex("by_created_by", (q) => q.eq("createdBy", userId))
        .order("desc")
        .collect();
    }
  },
});

export const getCampaign = query({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    return await ctx.db.get(args.campaignId);
  },
});

export const getCampaignEnrollments = query({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    return await ctx.db.query("campaignEnrollments")
      .withIndex("by_campaign", (q) => q.eq("campaignId", args.campaignId))
      .collect();
  },
});
