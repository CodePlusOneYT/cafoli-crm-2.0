import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export default function Landing() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate("/dashboard");
    }
  }, [isAuthenticated, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <nav className="border-b bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2 font-bold text-xl">
              <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground">
                C
              </div>
              Cafoli CRM
            </div>
            <Button onClick={() => navigate("/auth")}>Sign In</Button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <h1 className="text-5xl font-bold tracking-tight mb-6">
            Welcome to Cafoli CRM
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Manage your leads, campaigns, and customer relationships all in one place.
          </p>
          <Button size="lg" onClick={() => navigate("/auth")}>
            Get Started
          </Button>
        </motion.div>
      </main>
    </div>
  );
}