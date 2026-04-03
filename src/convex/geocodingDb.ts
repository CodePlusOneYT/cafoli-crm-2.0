import { v } from "convex/values";
import { internalQuery, internalMutation } from "./_generated/server";

export const queryLeadsNeedingGeocode = internalQuery({
  args: { cursor: v.optional(v.string()) },
  handler: async (ctx) => {
    // Get leads that have location data but no coordinates
    const leads = await ctx.db.query("leads").take(200);
    return leads.filter(
      (l: any) => !l.lat && !l.lng && (l.state || l.district || l.station || l.pincode)
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
    await ctx.db.patch(args.id, { lat: args.lat, lng: args.lng } as any);
  },
});