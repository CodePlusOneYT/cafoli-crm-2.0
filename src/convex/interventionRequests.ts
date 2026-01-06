import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

export const createInterventionRequest = mutation({
  args: {
    leadId: v.id("leads"),
    assignedTo: v.optional(v.id("users")),
    requestedProduct: v.optional(v.string()),
    customerMessage: v.string(),
    aiDraftedMessage: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("interventionRequests", {
      leadId: args.leadId,
      assignedTo: args.assignedTo,
      requestedProduct: args.requestedProduct,
      customerMessage: args.customerMessage,
      aiDraftedMessage: args.aiDraftedMessage,
      status: "pending",
      requiresFollowUp: false,
    });
  },
});

export const createInterventionRequestInternal = internalMutation({
  args: {
    leadId: v.id("leads"),
    assignedTo: v.optional(v.id("users")),
    requestedProduct: v.optional(v.string()),
    customerMessage: v.string(),
    aiDraftedMessage: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("interventionRequests", {
      leadId: args.leadId,
      assignedTo: args.assignedTo,
      requestedProduct: args.requestedProduct,
      customerMessage: args.customerMessage,
      aiDraftedMessage: args.aiDraftedMessage,
      status: "pending",
      requiresFollowUp: false,
    });
  },
});

export const getPendingInterventions = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    // Get interventions assigned to this user OR unassigned (for cold caller/unassigned leads)
    const allInterventions = await ctx.db
      .query("interventionRequests")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    // Filter for user's assigned interventions or unassigned ones
    const userInterventions = allInterventions.filter(
      (i) => i.assignedTo === args.userId || !i.assignedTo
    );

    // Enrich with lead data
    const enriched = await Promise.all(
      userInterventions.map(async (intervention) => {
        const lead = await ctx.db.get(intervention.leadId);
        return {
          ...intervention,
          lead,
        };
      })
    );

    return enriched;
  },
});

export const claimIntervention = mutation({
  args: {
    interventionId: v.id("interventionRequests"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const intervention = await ctx.db.get(args.interventionId);
    
    if (!intervention) {
      throw new Error("Intervention not found");
    }

    // Check if already claimed
    if (intervention.status === "claimed") {
      throw new Error("This intervention has already been claimed by another user");
    }

    // Update intervention
    await ctx.db.patch(args.interventionId, {
      status: "claimed",
      claimedBy: args.userId,
      claimedAt: Date.now(),
      requiresFollowUp: true,
    });

    // If lead was unassigned or cold caller, assign to claiming user
    const lead = await ctx.db.get(intervention.leadId);
    if (lead && (!lead.assignedTo || lead.isColdCallerLead)) {
      await ctx.db.patch(intervention.leadId, {
        assignedTo: args.userId,
        isColdCallerLead: false,
      });
    }

    return { success: true, leadId: intervention.leadId };
  },
});

export const resolveIntervention = mutation({
  args: {
    interventionId: v.id("interventionRequests"),
    status: v.union(v.literal("resolved"), v.literal("dismissed")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.interventionId, {
      status: args.status,
      resolvedAt: Date.now(),
    });
  },
});

export const checkFollowUpRequired = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    
    const interventions = await ctx.db
      .query("interventionRequests")
      .withIndex("by_claimed_by", (q) => q.eq("claimedBy", args.userId))
      .filter((q) => 
        q.and(
          q.eq(q.field("status"), "claimed"),
          q.eq(q.field("requiresFollowUp"), true),
          q.lt(q.field("claimedAt"), fiveMinutesAgo)
        )
      )
      .collect();

    if (interventions.length === 0) return null;

    // Get the lead for the first intervention
    const lead = await ctx.db.get(interventions[0].leadId);
    
    return {
      interventionId: interventions[0]._id,
      leadId: interventions[0].leadId,
      lead,
    };
  },
});

export const markFollowUpComplete = internalMutation({
  args: {
    interventionId: v.id("interventionRequests"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.interventionId, {
      requiresFollowUp: false,
      status: "resolved",
      resolvedAt: Date.now(),
    });
  },
});