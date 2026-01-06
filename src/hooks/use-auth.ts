import { useQuery, useMutation } from "convex/react";
import { useState, useEffect } from "react";
import { Id } from "@/convex/_generated/dataModel";
import { getConvexApiRuntime } from "@/lib/convex-api";

export function useAuth() {
  const [userId, setUserId] = useState<Id<"users"> | null>(() => {
    const stored = localStorage.getItem("cafoli_user_id");
    return stored as Id<"users"> | null;
  });

  const api = getConvexApiRuntime();

  // Add safety check for api before using it
  const user = useQuery(
    api?.users?.getUser ?? null,
    userId && api ? { id: userId } : "skip"
  );

  const login = useMutation(api?.users?.login ?? null);
  const createLog = useMutation(api?.activityLogs?.createLog ?? null);

  const signIn = async (email: string, password: string) => {
    if (!api || !login) {
      console.error("Convex API not loaded yet");
      return null;
    }

    const result = await login({ email, password });
    if (result) {
      setUserId(result);
      localStorage.setItem("cafoli_user_id", result);
      
      // Log login activity
      try {
        if (createLog) {
          await createLog({
            userId: result,
            category: "Login/Logout",
            action: "User logged in",
            details: `User ${email} logged in successfully`,
          });
        }
      } catch (error) {
        console.error("Failed to log login activity:", error);
      }
      
      return result;
    }
    return null;
  };

  const signOut = async () => {
    // Log logout activity
    if (userId && createLog) {
      try {
        await createLog({
          userId: userId,
          category: "Login/Logout",
          action: "User logged out",
          details: `User logged out`,
        });
      } catch (error) {
        console.error("Failed to log logout activity:", error);
      }
    }
    
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