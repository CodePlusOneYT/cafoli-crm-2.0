import { v } from "convex/values";
import { internalQuery, internalMutation } from "./_generated/server";

export const queryLeadsNeedingGeocode = internalQuery({
  args: { cursor: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // Use cursor-based pagination to process all leads over time
    const leads = await ctx.db
      .query("leads")
      .withIndex("by_last_activity")
      .order("desc")
      .take(500);
    return leads.filter(
      (l: any) => !l.lat && !l.lng && (l.state || l.district || l.station || l.pincode || l.country)
    );
  },
});

export const updateLeadCoordinates = internalMutation({
  args: {
    id: v.id("leads"),
    lat: v.number(),
    lng: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { lat: args.lat, lng: args.lng, geocodedAt: Date.now() } as any);
  },
});