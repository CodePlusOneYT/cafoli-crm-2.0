import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const upsertTemplate = internalMutation({
  args: {
    name: v.string(),
    language: v.string(),
    category: v.string(),
    status: v.string(),
    externalId: v.optional(v.string()),
    components: v.array(v.object({
      type: v.string(),
      format: v.optional(v.string()),
      text: v.optional(v.string()),
      buttons: v.optional(v.array(v.object({
        type: v.string(),
        text: v.string(),
        url: v.optional(v.string()),
        phoneNumber: v.optional(v.string()),
      }))),
    })),
  },
  handler: async (ctx, args) => {
    // Check if template exists
    const existing = await ctx.db
      .query("templates")
      .filter((q) => q.eq(q.field("name"), args.name))
      .filter((q) => q.eq(q.field("language"), args.language))
      .first();

    if (existing) {
      // Update existing template
      await ctx.db.patch(existing._id, {
        category: args.category,
        status: args.status,
        externalId: args.externalId,
        components: args.components,
        lastSyncedAt: Date.now(),
      });
      return existing._id;
    } else {
      // Create new template
      return await ctx.db.insert("templates", {
        name: args.name,
        language: args.language,
        category: args.category,
        status: args.status,
        externalId: args.externalId,
        components: args.components,
        lastSyncedAt: Date.now(),
      });
    }
  },
});
