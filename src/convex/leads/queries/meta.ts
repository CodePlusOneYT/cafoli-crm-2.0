import { v } from "convex/values";
import { query } from "../../_generated/server";
import { ROLES } from "../../schema";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getUniqueSources = query({
  args: {},
  handler: async (ctx) => {
    // Use the leadSourcesCache singleton for O(1) read
    const cache = await ctx.db.query("leadSourcesCache").first();
    if (cache) return cache.sources;
    // Fallback: scan up to 2000 leads if cache not yet populated
    const leads = await ctx.db.query("leads").withIndex("by_last_activity").order("desc").take(2000);
    const sources = new Set<string>();
    for (const lead of leads) {
      if (lead.source) sources.add(lead.source);
    }
    return Array.from(sources).sort();
  },
});

// Lightweight dashboard stats — reads only what's needed
export const getDashboardStats = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    const isAdmin = user.role === ROLES.ADMIN;
    const now = Date.now();
    const oneDayAgo = now - 86400000;

    // Only fetch the 10 most recent leads — 5 for display, a few extra for stats
    const recentLeads = isAdmin
      ? await ctx.db.query("leads").withIndex("by_last_activity").order("desc").take(10)
      : await ctx.db.query("leads").withIndex("by_assignedTo", q => q.eq("assignedTo", args.userId)).order("desc").take(10);

    // For new leads today: only scan last 24h using the index (stop early)
    const newLeadsToday = recentLeads.filter(l => l._creationTime > oneDayAgo).length;

    // For pending follow-ups: scan assigned leads only (bounded)
    const followUpSample = isAdmin
      ? await ctx.db.query("leads").withIndex("by_last_activity").order("desc").take(200)
      : recentLeads;
    const pendingFollowUps = followUpSample.filter(l => l.nextFollowUpDate && l.nextFollowUpDate < now).length;

    // Use leadSourcesCache for total count approximation (O(1) read)
    const sourcesCache = await ctx.db.query("leadSourcesCache").first();
    const r2Sample = await ctx.db.query("r2_leads_mock").take(100);

    return {
      totalLeads: (sourcesCache ? 0 : recentLeads.length) + r2Sample.length,
      convexCount: recentLeads.length,
      r2Count: r2Sample.length,
      newLeadsToday,
      pendingFollowUps,
      recentLeads: recentLeads.slice(0, 5),
    };
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

    const clean = (v: unknown): string => {
      if (v === null || v === undefined) return "";
      return String(v).replace(/[\r\n\t]+/g, " ").trim();
    };

    const convexLeads = await ctx.db.query("leads").withIndex("by_last_activity").order("desc").take(10000);
    
    // Batch fetch all assigned users
    const assignedUserIds = [...new Set(convexLeads.map(l => l.assignedTo).filter(Boolean))] as any[];
    const userDocs = await Promise.all(assignedUserIds.map(id => ctx.db.get(id)));
    const userMap = new Map(assignedUserIds.map((id, i) => [id, userDocs[i]]));

    const enrichedLeads = convexLeads.map((lead) => {
      const assignedUser = lead.assignedTo ? userMap.get(lead.assignedTo) : null;
      const assignedToName = (assignedUser as any)?.name || "";
      return {
        name: clean(lead.name),
        subject: clean(lead.subject),
        source: clean(lead.source),
        mobile: clean(lead.mobile),
        altMobile: clean(lead.altMobile),
        email: clean(lead.email),
        altEmail: clean(lead.altEmail),
        agencyName: clean(lead.agencyName),
        pincode: clean(lead.pincode),
        state: clean(lead.state),
        district: clean(lead.district),
        station: clean(lead.station),
        message: clean(lead.message),
        status: clean(lead.status),
        type: clean(lead.type),
        assignedTo: lead.assignedTo ?? null,
        assignedToName: clean(assignedToName),
        nextFollowUpDate: lead.nextFollowUpDate ?? null,
        lastActivity: lead.lastActivity,
        pharmavendsUid: clean(lead.pharmavendsUid),
        indiamartUniqueId: clean(lead.indiamartUniqueId),
        _id: lead._id,
        _creationTime: lead._creationTime,
        _isR2: false,
      };
    });

    return enrichedLeads;
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