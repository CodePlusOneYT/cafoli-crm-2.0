import { useState } from "react";
import { useQuery } from "convex/react";
import { useAuth } from "@/hooks/use-auth";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield, Filter, Download, Calendar } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";

const LOG_CATEGORIES = {
  ALL: "All Categories",
  AUTH: "Login/Logout",
  LEAD_STATUS: "Leads: Status",
  LEAD_INCOMING: "Leads: Incoming",
  LEAD_DELETION: "Leads: Deletion",
  LEAD_ASSIGNMENT: "Leads: Assignment",
  LEAD_DETAILS: "Leads: Details Change",
  WHATSAPP_OUTGOING: "WhatsApp: Message Going",
  WHATSAPP_INCOMING: "WhatsApp: Message Coming",
  WHATSAPP_STATUS: "WhatsApp: Message Statuses",
  EMAIL: "Email",
  OTHER: "Others",
};

export default function Logs() {
  const { user: currentUser } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [limit, setLimit] = useState<number>(100);

  const logs = useQuery(
    api.activityLogs.getLogs,
    currentUser
      ? {
          adminId: currentUser._id,
          category: selectedCategory !== "ALL" ? selectedCategory : undefined,
          startDate: startDate ? new Date(startDate).getTime() : undefined,
          endDate: endDate ? new Date(endDate).getTime() : undefined,
          limit,
        }
      : "skip"
  );

  const stats = useQuery(
    api.activityLogs.getLogStats,
    currentUser
      ? {
          adminId: currentUser._id,
          startDate: startDate ? new Date(startDate).getTime() : undefined,
          endDate: endDate ? new Date(endDate).getTime() : undefined,
        }
      : "skip"
  );

  const handleExportLogs = () => {
    if (!logs || logs.length === 0) {
      toast.error("No logs to export");
      return;
    }

    const csvContent = [
      ["Timestamp", "Category", "Action", "User", "Lead", "Details"].join(","),
      ...logs.map((log) =>
        [
          new Date(log.timestamp).toLocaleString(),
          log.category,
          log.action,
          log.userName || "System",
          log.leadName || "",
          log.details || "",
        ]
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `activity-logs-${Date.now()}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success("Logs exported successfully");
  };

  if (currentUser?.role !== "admin") {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <Card className="max-w-md">
            <CardContent className="pt-6">
              <div className="text-center">
                <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
                <p className="text-muted-foreground">
                  You need admin privileges to access activity logs.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const getCategoryColor = (category: string) => {
    if (category.includes("Login") || category.includes("Logout")) return "bg-blue-100 text-blue-800";
    if (category.includes("Leads")) return "bg-green-100 text-green-800";
    if (category.includes("WhatsApp")) return "bg-purple-100 text-purple-800";
    if (category.includes("Email")) return "bg-orange-100 text-orange-800";
    return "bg-gray-100 text-gray-800";
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Activity Logs</h1>
            <p className="text-muted-foreground">
              Monitor all CRM activities and system events
            </p>
          </div>
          <Button onClick={handleExportLogs} disabled={!logs || logs.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export Logs
          </Button>
        </div>

        {/* Statistics Cards */}
        {stats && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Activities</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total}</div>
              </CardContent>
            </Card>
            {Object.entries(stats.byCategory)
              .slice(0, 3)
              .map(([category, count]) => (
                <Card key={category}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">{category}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{count}</div>
                  </CardContent>
                </Card>
              ))}
          </div>
        )}

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(LOG_CATEGORIES).map(([key, label]) => (
                      <SelectItem key={key} value={key === "ALL" ? "ALL" : key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>End Date</Label>
                <Input
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Limit</Label>
                <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="250">250</SelectItem>
                    <SelectItem value="500">500</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Logs List */}
        <Card>
          <CardHeader>
            <CardTitle>Activity Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px] pr-4">
              {!logs ? (
                <div className="text-center py-8 text-muted-foreground">Loading logs...</div>
              ) : logs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No logs found for the selected filters
                </div>
              ) : (
                <div className="space-y-3">
                  {logs.map((log) => (
                    <div
                      key={log._id}
                      className="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-shrink-0 pt-1">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={getCategoryColor(log.category)}>
                            {log.category}
                          </Badge>
                          <span className="text-sm font-medium">{log.action}</span>
                          <span className="text-xs text-muted-foreground">
                            by {log.userName}
                          </span>
                        </div>
                        {log.details && (
                          <p className="text-sm text-muted-foreground">{log.details}</p>
                        )}
                        {log.leadName && (
                          <p className="text-xs text-muted-foreground">
                            Lead: {log.leadName}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {new Date(log.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
