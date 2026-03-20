import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";

export const LOG_CATEGORIES = {
  WHATSAPP_INCOMING: "whatsapp_incoming",
  WHATSAPP_OUTGOING: "whatsapp_outgoing",
  WHATSAPP_STATUS: "whatsapp_status",
  LEAD_INCOMING: "lead_incoming",
  EMAIL: "email",
} as const;

export const logActivity = internalMutation({
  args: {
    userId: v.optional(v.id("users")),
    action: v.string(),
    details: v.string(),
    leadId: v.optional(v.id("leads")),
    category: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const timestamp = Date.now();
    return await ctx.db.insert("activityLogs", {
      ...args,
      timestamp,
    });
  },
});

export const log = mutation({
  args: {
    userId: v.id("users"),
    action: v.string(),
    details: v.string(),
    leadId: v.optional(v.id("leads")),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const timestamp = Date.now();
    return await ctx.db.insert("activityLogs", {
      ...args,
      timestamp,
    });
  },
});

export const list = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("activityLogs")
      .withIndex("by_timestamp")
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

export const getByLead = query({
  args: { leadId: v.id("leads") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("activityLogs")
      .withIndex("by_lead", (q) => q.eq("leadId", args.leadId))
      .order("desc")
      .collect();
  },
});

export const getByUser = query({
  args: { userId: v.id("users"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const q = ctx.db
      .query("activityLogs")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc");
    
    if (args.limit) {
      return await q.take(args.limit);
    }
    return await q.collect();
  },
});

export const getByCategory = query({
  args: { category: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("activityLogs")
      .withIndex("by_category", (q) => q.eq("category", args.category))
      .order("desc")
      .collect();
  },
});

export const getLogs = query({
  args: {
    adminId: v.id("users"),
    category: v.optional(v.string()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Verify admin
    const user = await ctx.db.get(args.adminId);
    if (!user || user.role !== "admin") return [];

    let q = ctx.db.query("activityLogs").withIndex("by_timestamp").order("desc");

    const results = await q.take(args.limit ?? 100);

    return results
      .filter((log) => {
        if (args.category && log.category !== args.category) return false;
        if (args.startDate && log.timestamp < args.startDate) return false;
        if (args.endDate && log.timestamp > args.endDate) return false;
        return true;
      })
      .map((log) => ({
        ...log,
        userName: log.userId ? "User" : "System",
        leadName: undefined as string | undefined,
      }));
  },
});

export const getLogStats = query({
  args: {
    adminId: v.id("users"),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.adminId);
    if (!user || user.role !== "admin") return { total: 0, byCategory: {} };

    const logs = await ctx.db.query("activityLogs").withIndex("by_timestamp").order("desc").take(1000);

    const filtered = logs.filter((log) => {
      if (args.startDate && log.timestamp < args.startDate) return false;
      if (args.endDate && log.timestamp > args.endDate) return false;
      return true;
    });

    const byCategory: Record<string, number> = {};
    for (const log of filtered) {
      const cat = log.category ?? "Other";
      byCategory[cat] = (byCategory[cat] ?? 0) + 1;
    }

    return { total: filtered.length, byCategory };
  },
});