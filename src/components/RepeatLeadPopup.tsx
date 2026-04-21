import { useQuery, useMutation } from "convex/react";
import { getConvexApi } from "@/lib/convex-api";
import { useAuth } from "@/hooks/use-auth";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const api = getConvexApi() as any;

export function RepeatLeadPopup() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [shown, setShown] = useState(false);

  // Query repeat leads assigned to this user that came in recently (last 24h)
  const repeatLeads = useQuery(
    api.leads.queries.getRecentRepeatLeadsForUser,
    user ? { userId: user._id } : "skip"
  );

  const undismissed = (repeatLeads || []).filter((l: any) => !dismissed.has(l._id));

  // Only show once per session when new repeat leads arrive
  useEffect(() => {
    if (undismissed.length > 0 && !shown) {
      setShown(true);
    }
  }, [undismissed.length]);

  const handleDismiss = (leadId: string) => {
    setDismissed(prev => new Set([...prev, leadId]));
  };

  const handleDismissAll = () => {
    setDismissed(new Set((repeatLeads || []).map((l: any) => l._id)));
    setShown(false);
  };

  const handleViewLead = (leadId: string) => {
    navigate(`/my_leads?leadId=${leadId}`);
    handleDismissAll();
  };

  if (!user || !shown || undismissed.length === 0) return null;

  const lead = undismissed[0];

  return (
    <AnimatePresence>
      <div className="fixed bottom-6 right-6 z-[60] max-w-sm w-full">
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="bg-background border border-rose-200 rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Top stripe */}
          <div className="h-1 w-full bg-rose-500" />

          <div className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-rose-100 flex items-center justify-center">
                  <RefreshCw className="h-4 w-4 text-rose-600" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-rose-600 uppercase tracking-wide">Repeat Lead</p>
                  {undismissed.length > 1 && (
                    <p className="text-xs text-muted-foreground">{undismissed.length} repeat leads</p>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-full hover:bg-muted -mt-1 -mr-1"
                onClick={handleDismissAll}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>

            <p className="text-sm font-semibold text-foreground mb-0.5">{lead.name}</p>
            <p className="text-xs text-muted-foreground mb-3">
              Re-enquired via <span className="font-medium">{lead.repeatLeadSource || lead.source}</span>
              {lead.repeatLeadAt && (
                <> · {new Date(lead.repeatLeadAt).toLocaleString("en-IN", {
                  day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
                })}</>
              )}
            </p>

            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white text-xs h-8"
                onClick={() => handleViewLead(lead._id)}
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                View Lead
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-8"
                onClick={() => handleDismiss(lead._id)}
              >
                Dismiss
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
