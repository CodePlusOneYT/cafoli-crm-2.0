import { useQuery, useMutation } from "convex/react";
import { getConvexApi } from "@/lib/convex-api";
import { useAuth } from "@/hooks/use-auth";
import { motion, AnimatePresence } from "framer-motion";
import { X, Megaphone, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

const api = getConvexApi() as any;

export function AnnouncementPopup() {
  const { user } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);

  const announcements = useQuery(
    api.announcements.getUndismissedAnnouncements,
    user ? { userId: user._id } : "skip"
  );

  const dismiss = useMutation(api.announcements.dismissAnnouncement);

  if (!user || !announcements || announcements.length === 0) return null;

  const current = announcements[currentIndex];
  if (!current) return null;

  const handleDismiss = async () => {
    await dismiss({ announcementId: current._id, userId: user._id });
    if (currentIndex >= announcements.length - 1) {
      setCurrentIndex(0);
    }
  };

  const isUpdate = current.type === "update";

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <motion.div
          key={current._id}
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="relative w-full max-w-md mx-4"
        >
          <div className="bg-background rounded-2xl shadow-2xl border border-border overflow-hidden">
            {/* Header stripe */}
            <div className={`h-1.5 w-full ${isUpdate ? "bg-blue-500" : "bg-amber-500"}`} />

            <div className="p-6">
              {/* Icon + Badge */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${isUpdate ? "bg-blue-100 text-blue-600" : "bg-amber-100 text-amber-600"}`}>
                    {isUpdate ? <Zap className="h-5 w-5" /> : <Megaphone className="h-5 w-5" />}
                  </div>
                  <Badge
                    variant="secondary"
                    className={`text-xs font-semibold uppercase tracking-wide ${isUpdate ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}
                  >
                    {isUpdate ? "Update" : "Announcement"}
                  </Badge>
                </div>
                {announcements.length > 1 && (
                  <span className="text-xs text-muted-foreground font-medium">
                    {currentIndex + 1} / {announcements.length}
                  </span>
                )}
              </div>

              {/* Title */}
              <h2 className="text-xl font-bold text-foreground mb-2 leading-tight">
                {current.title}
              </h2>

              {/* Message */}
              <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap">
                {current.message}
              </p>

              {/* Footer */}
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
                <span className="text-xs text-muted-foreground">
                  {new Date(current.createdAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
                <div className="flex gap-2">
                  {announcements.length > 1 && currentIndex < announcements.length - 1 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentIndex((i) => i + 1)}
                    >
                      Next
                    </Button>
                  )}
                  <Button
                    size="sm"
                    className={isUpdate ? "bg-blue-600 hover:bg-blue-700 text-white" : "bg-amber-500 hover:bg-amber-600 text-white"}
                    onClick={handleDismiss}
                  >
                    Got it
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
