import { useQuery } from "convex/react";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router";
import { format } from "date-fns";
import { Clock, Bell } from "lucide-react";
import { api } from "@/convex/_generated/api";

export function FollowUpNotifications() {
  const { user: currentUser } = useAuth();
  const upcomingFollowUps = useQuery(
    api.leads.queries.getUpcomingFollowUps,
    currentUser ? { userId: currentUser._id } : "skip"
  );
  const navigate = useNavigate();

  const [shownNotifications, setShownNotifications] = useState<Set<string>>(new Set());
  const [currentNotification, setCurrentNotification] = useState<{
    lead: any;
    timeType: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!upcomingFollowUps || upcomingFollowUps.length === 0) return;

    const checkFollowUps = () => {
      const now = Date.now();

      for (const lead of upcomingFollowUps) {
        if (!lead.nextFollowUpDate) continue;

        const timeUntil = lead.nextFollowUpDate - now;
        const leadId = lead._id;

        // Check for 10 minutes (9:30 to 10:30 minutes)
        if (timeUntil > 9.5 * 60 * 1000 && timeUntil <= 10.5 * 60 * 1000) {
          const key = `${leadId}-10min`;
          if (!shownNotifications.has(key)) {
            setCurrentNotification({
              lead,
              timeType: "10 minutes",
              message: "Follow-up in 10 minutes"
            });
            setShownNotifications(prev => new Set(prev).add(key));
            return;
          }
        }

        // Check for 5 minutes (4:30 to 5:30 minutes)
        if (timeUntil > 4.5 * 60 * 1000 && timeUntil <= 5.5 * 60 * 1000) {
          const key = `${leadId}-5min`;
          if (!shownNotifications.has(key)) {
            setCurrentNotification({
              lead,
              timeType: "5 minutes",
              message: "Follow-up in 5 minutes"
            });
            setShownNotifications(prev => new Set(prev).add(key));
            return;
          }
        }

        // Check for 1 minute (30 seconds to 1:30 minutes)
        if (timeUntil > 30 * 1000 && timeUntil <= 1.5 * 60 * 1000) {
          const key = `${leadId}-1min`;
          if (!shownNotifications.has(key)) {
            setCurrentNotification({
              lead,
              timeType: "1 minute",
              message: "Follow-up in 1 minute"
            });
            setShownNotifications(prev => new Set(prev).add(key));
            return;
          }
        }

        // Check for exact time (within 30 seconds)
        if (timeUntil >= -15 * 1000 && timeUntil <= 30 * 1000) {
          const key = `${leadId}-now`;
          if (!shownNotifications.has(key)) {
            setCurrentNotification({
              lead,
              timeType: "now",
              message: "Follow-up time is NOW!"
            });
            setShownNotifications(prev => new Set(prev).add(key));
            return;
          }
        }
      }
    };

    // Check immediately
    checkFollowUps();

    // Check every 15 seconds
    const interval = setInterval(checkFollowUps, 15000);

    return () => clearInterval(interval);
  }, [upcomingFollowUps, shownNotifications]);

  const handleClose = () => {
    setCurrentNotification(null);
  };

  const navigateToLead = (leadId: string) => {
    navigate(`/leads?leadId=${leadId}`);
    handleClose();
  };

  if (!currentNotification) return null;

  const { lead, timeType, message } = currentNotification;
  const isNow = timeType === "now";

  return (
    <Dialog open={true} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className={`sm:max-w-[500px] ${isNow ? 'border-red-500 bg-red-50 dark:bg-red-950/20' : 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'}`}>
        <DialogHeader>
          <div className={`flex items-center gap-2 ${isNow ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
            {isNow ? <Bell className="h-6 w-6 animate-pulse" /> : <Clock className="h-6 w-6" />}
            <DialogTitle>{message}</DialogTitle>
          </div>
          <DialogDescription className={isNow ? 'text-red-700 dark:text-red-300' : 'text-blue-700 dark:text-blue-300'}>
            {isNow ? "It's time for your scheduled follow-up!" : "You have an upcoming follow-up scheduled."}
          </DialogDescription>
        </DialogHeader>
        
        <div className="bg-white dark:bg-card p-4 rounded-lg border shadow-sm">
          <h4 className="font-semibold text-lg">{lead.name}</h4>
          <p className="text-sm text-muted-foreground">{lead.agencyName}</p>
          
          <div className="mt-3 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Status:</span>
              <span className="font-medium">{lead.status}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Scheduled:</span>
              <span className="font-medium">
                {lead.nextFollowUpDate ? format(lead.nextFollowUpDate, "PPp") : "N/A"}
              </span>
            </div>
            {lead.mobile && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Mobile:</span>
                <span className="font-medium">{lead.mobile}</span>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={handleClose}>
            Dismiss
          </Button>
          <Button 
            variant={isNow ? "destructive" : "default"}
            onClick={() => navigateToLead(lead._id)}
            className={!isNow ? "bg-blue-600 hover:bg-blue-700" : ""}
          >
            {isNow ? "Follow Up Now" : "View Lead"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
