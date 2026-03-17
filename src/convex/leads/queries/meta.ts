import { v } from "convex/values";
import { query } from "../../_generated/server";
import { ROLES } from "../../schema";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getUniqueSources = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    let isAdmin = false;
    if (userId) {
      const user = await ctx.db.get(userId);
      isAdmin = user?.role === ROLES.ADMIN;
    }

    const leads = await ctx.db.query("leads").withIndex("by_last_activity").order("desc").take(5000);
    const sources = new Set<string>();
    
    for (const lead of leads) {
      if (lead.source) {
        if (!isAdmin && lead.source === "R2 Test") continue;
        sources.add(lead.source);
      }
    }
    
    return Array.from(sources).sort();
  },
});

export const getAllLeadsForExport = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const userId = args.userId;
    if (!userId) throw new Error("Unauthorized");
    
    const user = await ctx.db.get(userId);
    if (user?.role !== ROLES.ADMIN) {
      throw new Error("Only admins can export all leads");
    }

    // Fetch active Convex leads (up to 10000)
    const convexLeads = await ctx.db.query("leads").withIndex("by_last_activity").order("desc").take(10000);
    
    const enrichedConvexLeads = await Promise.all(
      convexLeads.map(async (lead) => {
        let assignedToName = "";
        if (lead.assignedTo) {
          const assignedUser = await ctx.db.get(lead.assignedTo);
          assignedToName = assignedUser?.name || "";
        }
        return { ...lead, assignedToName };
      })
    );

    // Fetch R2-archived leads (up to 10000)
    const r2Leads = await ctx.db.query("r2_leads_mock").take(10000);
    
    const enrichedR2Leads = r2Leads.map((r2Lead) => {
      // R2 lead data is stored as { lead, chats, messages, comments, followups }
      // or as a flat lead object
      const leadData = r2Lead.leadData?.lead ?? r2Lead.leadData;
      if (!leadData) return null;

      return {
        ...leadData,
        _id: r2Lead._id, // use r2 id for uniqueness
        _creationTime: r2Lead._creationTime,
        assignedToName: "",
        _isR2: true,
      };
    }).filter(Boolean);

    // Merge: Convex leads first, then R2 leads
    return [...enrichedConvexLeads, ...enrichedR2Leads];
  },
});

export const getNextDownloadNumber = query({
  args: {},
  handler: async (ctx) => {
    const lastExport = await ctx.db
      .query("exportLogs")
      .order("desc")
      .first();
    
    return (lastExport?.downloadNumber || 0) + 1;
  },
});