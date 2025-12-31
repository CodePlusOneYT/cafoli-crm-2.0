import { internalQuery } from "./_generated/server";

export const checkHashFormat = internalQuery({
  args: {},
  handler: async (ctx) => {
    const user = await ctx.db.query("users").first();
    if (user && user.passwordHash) {
      console.log("DEBUG: Found password hash:", user.passwordHash);
      return user.passwordHash;
    } else {
      console.log("DEBUG: No user with password hash found");
      return null;
    }
  },
});
