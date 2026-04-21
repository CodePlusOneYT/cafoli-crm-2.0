import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Create a new announcement (admin only)
export const createAnnouncement = mutation({
  args: {
    title: v.string(),
    message: v.string(),
    type: v.string(), // "announcement" | "update"
    adminId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const admin = await ctx.db.get(args.adminId);
    if (!admin || admin.role !== "admin") {
      throw new Error("Only admins can create announcements");
    }

    return await ctx.db.insert("announcements", {
      title: args.title,
      message: args.message,
      type: args.type,
      createdBy: args.adminId,
      createdAt: Date.now(),
      isActive: true,
    });
  },
});

// Delete an announcement (admin only)
export const deleteAnnouncement = mutation({
  args: {
    announcementId: v.id("announcements"),
    adminId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const admin = await ctx.db.get(args.adminId);
    if (!admin || admin.role !== "admin") {
      throw new Error("Only admins can delete announcements");
    }
    await ctx.db.delete(args.announcementId);
  },
});

// Get all active announcements
export const getActiveAnnouncements = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("announcements")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .order("desc")
      .take(20);
  },
});

// Get all announcements (for admin management)
export const getAllAnnouncements = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("announcements")
      .withIndex("by_createdAt")
      .order("desc")
      .take(50);
  },
});

// Dismiss an announcement for a user
export const dismissAnnouncement = mutation({
  args: {
    announcementId: v.id("announcements"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Check if already dismissed
    const existing = await ctx.db
      .query("announcementDismissals")
      .withIndex("by_user_and_announcement", (q) =>
        q.eq("userId", args.userId).eq("announcementId", args.announcementId)
      )
      .first();

    if (!existing) {
      await ctx.db.insert("announcementDismissals", {
        userId: args.userId,
        announcementId: args.announcementId,
        dismissedAt: Date.now(),
      });
    }
  },
});

// Get undismissed announcements for a user
export const getUndismissedAnnouncements = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const activeAnnouncements = await ctx.db
      .query("announcements")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .order("desc")
      .take(20);

    if (activeAnnouncements.length === 0) return [];

    // Get all dismissals for this user
    const dismissals = await ctx.db
      .query("announcementDismissals")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .take(200);

    const dismissedIds = new Set(dismissals.map((d) => d.announcementId));

    return activeAnnouncements.filter((a) => !dismissedIds.has(a._id));
  },
});
