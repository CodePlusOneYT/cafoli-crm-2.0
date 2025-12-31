import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuthActions } from "@convex-dev/auth/react";

export function useAuth() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  // Cast api to any to avoid "Type instantiation is excessively deep" error
  const user = useQuery((api as any).users.currentUser);
  const { signOut } = useAuthActions();

  return {
    isAuthenticated,
    isLoading,
    user,
    signOut,
  };
}