import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useState, useCallback } from "react";
import { Id } from "@/convex/_generated/dataModel";

const STORAGE_KEY = "cafoli_user_id";

export function useAuth() {
  const [userId, setUserId] = useState<Id<"users"> | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? (stored as Id<"users">) : null;
    } catch {
      return null;
    }
  });

  const user = useQuery(api.users.getUser, { id: userId ?? undefined });
  const loginMutation = useMutation(api.users.login);

  const signIn = useCallback(async (provider: string, formData: FormData) => {
    // We ignore provider and assume password flow for this simple implementation
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    
    if (!email || !password) {
      throw new Error("Email and password required");
    }

    const result = await loginMutation({ email, password });
    if (result) {
      localStorage.setItem(STORAGE_KEY, result);
      setUserId(result);
      return result;
    } else {
      throw new Error("Invalid credentials");
    }
  }, [loginMutation]);

  const signOut = useCallback(async () => {
    localStorage.removeItem(STORAGE_KEY);
    setUserId(null);
  }, []);

  // If we have a userId but user is undefined, we are loading
  const isLoading = userId !== null && user === undefined;
  const isAuthenticated = !!userId;

  return {
    isLoading,
    isAuthenticated,
    user,
    signIn,
    signOut,
  };
}