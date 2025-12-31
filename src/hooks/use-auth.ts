import { useConvexAuth } from "convex/react";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";

export function useAuth() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  
  const user = useQuery(
    api.users.currentUser, 
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