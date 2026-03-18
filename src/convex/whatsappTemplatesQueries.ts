import { internalQuery, query } from "./_generated/server";
import { v } from "convex/values";

export const getLeadForTemplate = internalQuery({
  args: {
    leadId: v.id("leads"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.leadId);
  },
});

export const getTemplate = internalQuery({
  args: {
    templateId: v.id("templates"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.templateId);
  },
});

export const getTemplates = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("templates").collect();
  },
});

export const findLeadIdByPhone = internalQuery({
  args: { phone: v.string() },
  handler: async (ctx, args) => {
    const lead = await ctx.db
      .query("leads")
      .withIndex("by_mobile", (q) => q.eq("mobile", args.phone))
      .first();
    return lead ? (lead._id as string) : null;
  },
});

export const findR2IdByPhone = internalQuery({
  args: { phone: v.string() },
  handler: async (ctx, args) => {
    const r2 = await ctx.db
      .query("r2_leads_mock")
      .filter((q) => q.eq(q.field("mobile"), args.phone))
      .first();
    return r2 ? (r2._id as string) : null;
  },
});

export const getCachedMediaId = internalQuery({
  args: { cacheKey: v.string() },
  handler: async (ctx, args) => {
    const entry = await ctx.db
      .query("whatsappConfig")
      .withIndex("by_key", (q) => q.eq("key", args.cacheKey))
      .first();
    return entry ? entry.value : null;
  },
});