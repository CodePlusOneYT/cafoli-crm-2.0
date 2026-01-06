import { mutation, query, internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const createRangePdf = mutation({
  args: {
    name: v.string(),
    division: v.optional(v.string()),
    category: v.optional(v.string()),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const rangeId = await ctx.db.insert("rangePdfs", {
      name: args.name,
      division: args.division,
      category: args.category || "DIVISION",
      storageId: args.storageId,
    });
    return rangeId;
  },
});

export const listRangePdfs = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("rangePdfs").order("desc").collect();
  },
});

// Internal version for use in actions
export const listRangePdfsInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("rangePdfs").order("desc").collect();
  },
});

export const deleteRangePdf = mutation({
  args: { id: v.id("rangePdfs") },
  handler: async (ctx, args) => {
    const rangePdf = await ctx.db.get(args.id);
    if (!rangePdf) {
      throw new Error("Range PDF not found");
    }
    
    await ctx.storage.delete(rangePdf.storageId);
    await ctx.db.delete(args.id);
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const updateRangePdf = mutation({
  args: {
    id: v.id("rangePdfs"),
    name: v.string(),
    division: v.optional(v.string()),
    category: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const range = await ctx.db.get(args.id);
    if (!range) throw new Error("Range PDF not found");

    const updates: any = {
      name: args.name,
      division: args.division,
      category: args.category || "DIVISION",
    };

    if (args.storageId) {
      // await ctx.storage.delete(range.storageId); // Optional cleanup
      updates.storageId = args.storageId;
    }

    await ctx.db.patch(args.id, updates);
  },
});