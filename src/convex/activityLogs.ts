import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// Log categories
export const LOG_CATEGORIES = {
  AUTH: "Login/Logout",
  LEAD_STATUS: "Leads: Status",
  LEAD_INCOMING: "Leads: Incoming",
  LEAD_DELETION: "Leads: Deletion",
  LEAD_ASSIGNMENT: "Leads: Assignment",
  LEAD_DETAILS: "Leads: Details Change",
  WHATSAPP_OUTGOING: "WhatsApp: Message Going",
  WHATSAPP_INCOMING: "WhatsApp: Message Coming",
  WHATSAPP_STATUS: "WhatsApp: Message Statuses",
  EMAIL: "Email",
  OTHER: "Others",
} as const;

// Internal mutation for logging (can be called from other backend functions)
export const logActivity = internalMutation({
  args: {
    userId: v.optional(v.id("users")),
    category: v.string(),
    action: v.string(),
    details: v.optional(v.string()),
    metadata: v.optional(v.any()),
    leadId: v.optional(v.id("leads")),
    ipAddress: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("activityLogs", {
      userId: args.userId,
      category: args.category,
      action: args.action,
      details: args.details,
      metadata: args.metadata,
      leadId: args.leadId,
      ipAddress: args.ipAddress,
      timestamp: Date.now(),
    });
  },
});

// Public mutation for client-side logging
export const createLog = mutation({
  args: {
    userId: v.id("users"),
    category: v.string(),
    action: v.string(),
    details: v.optional(v.string()),
    metadata: v.optional(v.any()),
    leadId: v.optional(v.id("leads")),
  },
  handler: async (ctx, args) => {
    // Verify user is admin for sensitive operations
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    await ctx.db.insert("activityLogs", {
      userId: args.userId,
      category: args.category,
      action: args.action,
      details: args.details,
      metadata: args.metadata,
      leadId: args.leadId,
      timestamp: Date.now(),
    });
  },
});

// Query logs with filtering
export const getLogs = query({
  args: {
    adminId: v.id("users"),
    category: v.optional(v.string()),
    userId: v.optional(v.id("users")),
    leadId: v.optional(v.id("leads")),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Verify admin access
    const admin = await ctx.db.get(args.adminId);
    if (!admin || admin.role !== "admin") {
      throw new Error("Admin access required");
    }

    // Apply filters and get logs
    let logs;
    if (args.category) {
      const category = args.category;
      logs = await ctx.db
        .query("activityLogs")
        .withIndex("by_category", (q) => q.eq("category", category))
        .order("desc")
        .take(args.limit || 100);
    } else if (args.userId) {
      const userId = args.userId;
      logs = await ctx.db
        .query("activityLogs")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .order("desc")
        .take(args.limit || 100);
    } else if (args.leadId) {
      const leadId = args.leadId;
      logs = await ctx.db
        .query("activityLogs")
        .withIndex("by_lead", (q) => q.eq("leadId", leadId))
        .order("desc")
        .take(args.limit || 100);
    } else {
      logs = await ctx.db
        .query("activityLogs")
        .withIndex("by_timestamp")
        .order("desc")
        .take(args.limit || 100);
    }

    // Additional filtering for date range
    if (args.startDate || args.endDate) {
      logs = logs.filter((log) => {
        if (args.startDate && log.timestamp < args.startDate) return false;
        if (args.endDate && log.timestamp > args.endDate) return false;
        return true;
      });
    }

    // Enrich with user and lead data
    const enrichedLogs = await Promise.all(
      logs.map(async (log) => {
        const user = log.userId ? await ctx.db.get(log.userId) : null;
        const lead = log.leadId ? await ctx.db.get(log.leadId) : null;

        return {
          ...log,
          userName: user?.name || user?.email || "System",
          leadName: lead?.name || undefined,
        };
      })
    );

    return enrichedLogs;
  },
});

// Get log statistics
export const getLogStats = query({
  args: {
    adminId: v.id("users"),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Verify admin access
    const admin = await ctx.db.get(args.adminId);
    if (!admin || admin.role !== "admin") {
      throw new Error("Admin access required");
    }

    const logs = await ctx.db.query("activityLogs").collect();

    // Filter by date range
    const filteredLogs = logs.filter((log) => {
      if (args.startDate && log.timestamp < args.startDate) return false;
      if (args.endDate && log.timestamp > args.endDate) return false;
      return true;
    });

    // Calculate statistics by category
    const statsByCategory: Record<string, number> = {};
    filteredLogs.forEach((log) => {
      statsByCategory[log.category] = (statsByCategory[log.category] || 0) + 1;
    });

    return {
      total: filteredLogs.length,
      byCategory: statsByCategory,
    };
  },
});
