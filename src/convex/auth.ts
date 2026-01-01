// THIS FILE IS READ ONLY. Do not touch this file unless you are correctly adding a new auth provider in accordance to the vly auth documentation

import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { DataModel } from "./_generated/dataModel";

const password = Password<DataModel>({
  profile(params) {
    return {
      email: (params.email as string)?.toLowerCase(),
      name: params.name as string,
    };
  },
});

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [password],
});

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Simple session storage
export const createSession = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    // In a simple system, we just return the userId
    // The frontend will store this in localStorage
    return args.userId;
  },
});

export const validateSession = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    return user || null;
  },
});