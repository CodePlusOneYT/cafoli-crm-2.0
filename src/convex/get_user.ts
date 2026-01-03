import { query } from "./_generated/server";

export const getFirstUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await ctx.db.query("users").first();
    return user?._id;
  },
});
