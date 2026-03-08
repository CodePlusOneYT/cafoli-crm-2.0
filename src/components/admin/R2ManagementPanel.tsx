import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { getConvexApi } from "@/lib/convex-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Database, ArrowUpDown, RefreshCw, Play, CheckCircle2, XCircle, Clock } from "lucide-react";

const api = getConvexApi() as any;

interface R2TestResult {
  sendTimeMs: number;
  verifyTimeMs: number;
  offloadTimeMs: number;
  loadTimeMs: number;
  totalTestLeadsFound: number;
  mismatchCount: number;
  loadedCount: number;
  success: boolean;
}

export function R2ManagementPanel() {
  const r2Stats = useQuery(api.r2_cache_prototype.getR2Stats);
  const generateTestLeads = useMutation(api.r2_cache_prototype.generateTestLeads);
  const offloadToR2 = useMutation(api.r2_cache_prototype.offloadToR2);
  const loadFromR2 = useMutation(api.r2_cache_prototype.loadFromR2);
  const simulateWebhooksAndTestR2 = useAction(api.test_utils.simulateWebhooksAndTestR2);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isOffloading, setIsOffloading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<R2TestResult | null>(null);

  const handleGenerateLeads = async () => {
    setIsGenerating(true);
    try {
      const result = await generateTestLeads({});
      toast.success(result as string);
    } catch (e: any) {
      toast.error(e.message || "Failed to generate test leads");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleOffload = async () => {
    setIsOffloading(true);
    try {
      const result = await offloadToR2({ limit: 50 });
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

  const handleFullTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      toast.info("Running full R2 simulation test... this may take ~10 seconds");
      const result = await simulateWebhooksAndTestR2({});
      setTestResult(result as R2TestResult);
      if ((result as R2TestResult).success) {
        toast.success("R2 test passed! All data integrity checks passed.");
      } else {
        toast.warning(`R2 test completed with issues. Found ${(result as R2TestResult).totalTestLeadsFound}/300 leads.`);
      }
    } catch (e: any) {
      toast.error(e.message || "R2 test failed");
    } finally {
      setIsTesting(false);
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
                <p className="text-2xl font-bold">{r2Stats?.convexActiveCount ?? "—"}</p>
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
                <p className="text-2xl font-bold">{r2Stats?.r2StorageCount ?? "—"}</p>
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
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Hot/Cold data tiering prototype. R2 Test leads are only visible to admins.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateLeads}
              disabled={isGenerating}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isGenerating ? "animate-spin" : ""}`} />
              {isGenerating ? "Generating..." : "Generate 150 Test Leads"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleOffload}
              disabled={isOffloading}
            >
              <ArrowUpDown className="h-4 w-4 mr-2" />
              {isOffloading ? "Offloading..." : "Offload 50 → R2"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLoad}
              disabled={isLoading}
            >
              <ArrowUpDown className="h-4 w-4 mr-2 rotate-180" />
              {isLoading ? "Loading..." : "Load 50 ← R2"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Full Test */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Full Durability Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Simulates 150 concurrent webhook leads (75 IndiaMART + 75 WhatsApp), verifies all 300 leads arrive correctly, offloads to R2, loads back, and checks data integrity.
          </p>
          <Button onClick={handleFullTest} disabled={isTesting}>
            <Play className={`h-4 w-4 mr-2 ${isTesting ? "animate-pulse" : ""}`} />
            {isTesting ? "Running Test (~10s)..." : "Run Full R2 Test"}
          </Button>

          {testResult && (
            <div className={`p-4 rounded-md border space-y-3 ${testResult.success ? "bg-green-50 border-green-200 dark:bg-green-950/20" : "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20"}`}>
              <div className="flex items-center gap-2">
                {testResult.success ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-yellow-600" />
                )}
                <span className="font-semibold">
                  {testResult.success ? "Test Passed" : "Test Completed with Issues"}
                </span>
                <Badge variant={testResult.success ? "default" : "secondary"}>
                  {testResult.mismatchCount === 0 ? "0 Mismatches" : `${testResult.mismatchCount} Mismatches`}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="space-y-1">
                  <p className="font-medium">Lead Counts</p>
                  <p className="text-muted-foreground">Total Found: <span className="font-mono text-foreground">{testResult.totalTestLeadsFound}/300</span></p>
                  <p className="text-muted-foreground">Loaded Back: <span className="font-mono text-foreground">{testResult.loadedCount}</span></p>
                  <p className="text-muted-foreground">Data Mismatches: <span className={`font-mono ${testResult.mismatchCount > 0 ? "text-red-600" : "text-green-600"}`}>{testResult.mismatchCount}</span></p>
                </div>
                <div className="space-y-1">
                  <p className="font-medium flex items-center gap-1"><Clock className="h-3 w-3" /> Timing</p>
                  <p className="text-muted-foreground">Webhook Send: <span className="font-mono text-foreground">{testResult.sendTimeMs}ms</span></p>
                  <p className="text-muted-foreground">Verify: <span className="font-mono text-foreground">{testResult.verifyTimeMs}ms</span></p>
                  <p className="text-muted-foreground">Offload to R2: <span className="font-mono text-foreground">{testResult.offloadTimeMs}ms</span></p>
                  <p className="text-muted-foreground">Load from R2: <span className="font-mono text-foreground">{testResult.loadTimeMs}ms</span></p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
