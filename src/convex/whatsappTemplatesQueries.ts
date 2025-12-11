import { query } from "./_generated/server";
import { v } from "convex/values";

export const getTemplates = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("templates").order("desc").collect();
  },
});
