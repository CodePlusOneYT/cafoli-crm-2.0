import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

export const checkLeadExists = internalQuery({
  args: { uid: v.string() },
  handler: async (ctx, args) => {
    const lead = await ctx.db
      .query("leads")
      .filter((q) => q.eq(q.field("pharmavendsUid"), args.uid))
      .first();
    
    if (!lead) return null;

    return {
      _id: lead._id,
      type: lead.type,
    };
  },
});

export const reactivateLead = internalMutation({
  args: { id: v.id("leads") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      type: "To be Decided",
      status: "Cold", // Reset status to Cold
      assignedTo: undefined, // Ensure it is unassigned
      adminAssignmentRequired: true,
      lastActivity: Date.now(),
    });
  },
});

export const createPharmavendsLead = internalMutation({
  args: {
    uid: v.string(),
    name: v.string(),
    subject: v.string(),
    mobile: v.string(),
    altMobile: v.optional(v.string()),
    email: v.optional(v.string()),
    altEmail: v.optional(v.string()),
    agencyName: v.optional(v.string()),
    pincode: v.optional(v.string()),
    state: v.optional(v.string()),
    district: v.optional(v.string()),
    station: v.optional(v.string()),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Generate search text
    const searchText = [
      args.name,
      args.subject,
      args.mobile,
      args.altMobile,
      args.email,
      args.altEmail,
      args.message
    ].filter(Boolean).join(" ");

    const leadId = await ctx.db.insert("leads", {
      name: args.name,
      subject: args.subject,
      source: "Website and Pharmavends",
      mobile: args.mobile,
      altMobile: args.altMobile,
      email: args.email,
      altEmail: args.altEmail,
      agencyName: args.agencyName,
      pincode: args.pincode,
      state: args.state,
      district: args.district,
      station: args.station,
      message: args.message,
      status: "Cold",
      type: "To be Decided",
      lastActivity: Date.now(),
      pharmavendsUid: args.uid,
      searchText,
    });
    
    // Send welcome email
    if (args.email) {
      try {
        await ctx.scheduler.runAfter(0, internal.brevo.sendWelcomeEmail, {
          leadName: args.name,
          leadEmail: args.email,
          source: "Website and Pharmavends",
        });
      } catch (error) {
        console.error("Failed to schedule welcome email:", error);
        // Don't throw - lead creation should succeed even if email fails
      }
    }
    
    return leadId;
  },
});