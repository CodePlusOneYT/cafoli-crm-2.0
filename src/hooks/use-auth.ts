import { useConvexAuth } from "convex/react";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";

export function useAuth() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  
  // Import api dynamically to avoid circular type issues
  let apiRef: any = null;
  try {
    apiRef = require("@/convex/_generated/api").api;
  } catch (e) {
    console.error("Failed to load api", e);
  }
  
  const user = useQuery(
    apiRef?.users?.currentUser, 
    isAuthenticated ? {} : "skip"
  );
  const { signIn, signOut } = useAuthActions();

  return {
    isLoading: isLoading || (isAuthenticated && user === undefined),
    isAuthenticated,
    user: user ?? null,
    signIn,
    signOut,
  };
}