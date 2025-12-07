import { motion } from "framer-motion";
import { useNavigate } from "react-router";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";

export default function Landing() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        navigate("/dashboard", { replace: true });
      } else {
        navigate("/auth", { replace: true });
      }
    }
  }, [isAuthenticated, isLoading, navigate]);

  // Show loading state while checking authentication
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Loading...</div>
    </div>
  );
}