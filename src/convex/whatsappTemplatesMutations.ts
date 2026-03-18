import { internalMutation, mutation } from "./_generated/server";
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
    // Use collect + JS filter since templates table has no composite index on name+language
    const allTemplates = await ctx.db.query("templates").collect();
    const existingTemplate = allTemplates.find(
      (t) => t.name === args.name && t.language === args.language
    );

    if (existingTemplate) {
      await ctx.db.patch(existingTemplate._id, {
        category: args.category,
        status: args.status,
        externalId: args.externalId,
        components: args.components,
        lastSyncedAt: Date.now(),
      });
      return existingTemplate._id;
    } else {
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

export const deleteTemplate = internalMutation({
  args: {
    templateId: v.id("templates"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.templateId);
  },
});

export const setCachedMediaId = internalMutation({
  args: { cacheKey: v.string(), mediaId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("whatsappConfig")
      .withIndex("by_key", (q) => q.eq("key", args.cacheKey))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { value: args.mediaId });
    } else {
      await ctx.db.insert("whatsappConfig", { key: args.cacheKey, value: args.mediaId });
    }
  },
});