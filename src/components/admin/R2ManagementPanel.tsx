import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { getConvexApi } from "@/lib/convex-api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Database, ArrowUpDown, Clock } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const api = getConvexApi() as any;

export function R2ManagementPanel() {
  const r2Stats = useQuery(api.r2_cache_prototype.getR2Stats);
  const offloadToR2 = useMutation(api.r2_cache_prototype.offloadToR2);
  const loadFromR2 = useMutation(api.r2_cache_prototype.loadFromR2);

  const [isOffloading, setIsOffloading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [daysInactive, setDaysInactive] = useState("30");

  const handleOffload = async () => {
    setIsOffloading(true);
    try {
      const result = await offloadToR2({ limit: 50, daysInactive: parseInt(daysInactive) });
      toast.success(result as string);
    } catch (e: any) {
      toast.error(e.message || "Failed to offload leads");
    } finally {
      setIsOffloading(false);
    }
  };

  const handleLoad = async () => {
    setIsLoading(true);
    try {
      const result = await loadFromR2({ limit: 50 });
      toast.success(result as string);
    } catch (e: any) {
      toast.error(e.message || "Failed to load leads from R2");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Database className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{r2Stats?.convexActiveCount ?? "—"}{r2Stats?.convexActiveCount === 5000 ? "+" : ""}</p>
                <p className="text-sm text-muted-foreground">Active in Convex (Hot)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Database className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">{r2Stats?.r2StorageCount ?? "—"}{r2Stats?.r2StorageCount === 5000 ? "+" : ""}</p>
                <p className="text-sm text-muted-foreground">Archived in R2 (Cold)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Data Tiering Controls</CardTitle>
          <CardDescription>
            Manage hot/cold data tiering for the entire CRM. Offload inactive leads to cold storage to save database costs, and load them back when needed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Offload leads inactive for:</span>
              <Select value={daysInactive} onValueChange={setDaysInactive}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Select days" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 Days</SelectItem>
                  <SelectItem value="30">30 Days</SelectItem>
                  <SelectItem value="90">90 Days</SelectItem>
                  <SelectItem value="180">180 Days</SelectItem>
                  <SelectItem value="365">1 Year</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={handleOffload}
                disabled={isOffloading}
              >
                <ArrowUpDown className="h-4 w-4 mr-2" />
                {isOffloading ? "Offloading..." : "Offload 50 → R2"}
              </Button>
              <Button
                variant="outline"
                onClick={handleLoad}
                disabled={isLoading}
              >
                <ArrowUpDown className="h-4 w-4 mr-2 rotate-180" />
                {isLoading ? "Loading..." : "Load 50 ← R2"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
