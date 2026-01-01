import { useQuery, useMutation } from "convex/react";
import { useState, useEffect } from "react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

export function useAuth() {
  const [userId, setUserId] = useState<Id<"users"> | null>(() => {
    const stored = localStorage.getItem("cafoli_user_id");
    return stored as Id<"users"> | null;
  });

  const user = useQuery(
    api.users.getUser,
    userId ? { id: userId } : "skip"
  );

  const login = useMutation(api.users.login);

  const signIn = async (email: string, password: string) => {
    const result = await login({ email, password });
    if (result) {
      setUserId(result);
      localStorage.setItem("cafoli_user_id", result);
      return result;
    }
    return null;
  };

  const signOut = async () => {
    setUserId(null);
    localStorage.removeItem("cafoli_user_id");
  };

  return {
    isLoading: userId !== null && user === undefined,
    isAuthenticated: userId !== null && user !== null,
    user: user ?? null,
    signIn,
    signOut,
  };
}