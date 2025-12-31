import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getAllTemplates = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("emailTemplates").order("desc").collect();
  },
});

export const createTemplate = mutation({
  args: {
    name: v.string(),
    subject: v.string(),
    content: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("emailTemplates", {
      name: args.name,
      subject: args.subject,
      content: args.content,
      createdBy: args.userId,
      lastModifiedAt: Date.now(),
    });
  },
});

export const updateTemplate = mutation({
  args: {
    id: v.id("emailTemplates"),
    name: v.string(),
    subject: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      name: args.name,
      subject: args.subject,
      content: args.content,
      lastModifiedAt: Date.now(),
    });
  },
});

export const deleteTemplate = mutation({
  args: {
    id: v.id("emailTemplates"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
