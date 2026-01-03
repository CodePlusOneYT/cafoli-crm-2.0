import { internalQuery } from "./_generated/server";

export const getAnyUser = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("users").first();
  }
});
