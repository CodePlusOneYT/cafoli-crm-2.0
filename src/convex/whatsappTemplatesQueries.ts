import { query } from "./_generated/server";

export const getTemplates = query({
  handler: async (ctx) => {
    return await ctx.db.query("templates").collect();
  },
});