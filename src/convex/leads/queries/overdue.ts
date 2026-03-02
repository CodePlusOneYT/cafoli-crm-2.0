import { v } from "convex/values";
import { query } from "../../_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Doc } from "../../_generated/dataModel";

export const getOverdueLeads = query({
  args: { userId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    const userId = args.userId || await getAuthUserId(ctx);
    if (!userId) return [];

    const user = await ctx.db.get(userId);
    const isAdmin = user?.role === "admin";
    
    let leads: Doc<"leads">[] = [];
    const now = Date.now();
    
    if (isAdmin) {
      leads = await ctx.db.query("leads").collect();
    } else {
      leads = await ctx.db
        .query("leads")
        .withIndex("by_assignedTo", (q) => q.eq("assignedTo", userId))
        .collect();
    }
    
    return leads
      .filter((l: Doc<"leads">) => l.type !== "Irrelevant" && l.nextFollowUpDate && l.nextFollowUpDate < now)
      .sort((a: Doc<"leads">, b: Doc<"leads">) => (a.nextFollowUpDate || 0) - (b.nextFollowUpDate || 0));
  }
});

export const getCriticalOverdueLeads = query({
  args: { userId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    const userId = args.userId || await getAuthUserId(ctx);
    if (!userId) return [];

    const user = await ctx.db.get(userId);
    const isAdmin = user?.role === "admin";
    
    let leads: Doc<"leads">[] = [];
    const now = Date.now();
    
    if (isAdmin) {
      leads = await ctx.db.query("leads").collect();
    } else {
      leads = await ctx.db
        .query("leads")
        .withIndex("by_assignedTo", (q) => q.eq("assignedTo", userId))
        .collect();
    }
    
    return leads
      .filter((l: Doc<"leads">) => 
        l.type !== "Irrelevant" && 
        l.nextFollowUpDate && 
        l.nextFollowUpDate < now &&
        (l.status === "Hot" || l.status === "Mature")
      )
      .sort((a: Doc<"leads">, b: Doc<"leads">) => (a.nextFollowUpDate || 0) - (b.nextFollowUpDate || 0));
  }
});

export const getColdOverdueLeads = query({
  args: { userId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    const userId = args.userId || await getAuthUserId(ctx);
    if (!userId) return [];

    const user = await ctx.db.get(userId);
    const isAdmin = user?.role === "admin";
    
    let leads: Doc<"leads">[] = [];
    const now = Date.now();
    
    if (isAdmin) {
      leads = await ctx.db.query("leads").collect();
    } else {
      leads = await ctx.db
        .query("leads")
        .withIndex("by_assignedTo", (q) => q.eq("assignedTo", userId))
        .collect();
    }
    
    return leads
      .filter((l: Doc<"leads">) => 
        l.type !== "Irrelevant" && 
        (l.status === "Cold" || l.type === "To be Decided") &&
        l.nextFollowUpDate && 
        l.nextFollowUpDate < now
      )
      .sort((a: Doc<"leads">, b: Doc<"leads">) => (a.nextFollowUpDate || 0) - (b.nextFollowUpDate || 0));
  }
});