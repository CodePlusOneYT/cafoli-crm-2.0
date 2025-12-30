import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getAllTags = query({
  handler: async (ctx) => {
    return await ctx.db.query("tags").collect();
  },
});

export const createTag = mutation({
  args: {
    name: v.string(),
    color: v.string(),
  },
  handler: async (ctx, args) => {
    // Check uniqueness
    const existingName = await ctx.db
      .query("tags")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();
    if (existingName) throw new Error("Tag name already exists");

    const existingColor = await ctx.db
      .query("tags")
      .withIndex("by_color", (q) => q.eq("color", args.color))
      .first();
    if (existingColor) throw new Error("Tag color already exists");

    return await ctx.db.insert("tags", { name: args.name, color: args.color });
  },
});

export const getTagsByIds = query({
  args: { ids: v.array(v.id("tags")) },
  handler: async (ctx, args) => {
    const tags = [];
    for (const id of args.ids) {
      const tag = await ctx.db.get(id);
      if (tag) tags.push(tag);
    }
    return tags;
  },
});
