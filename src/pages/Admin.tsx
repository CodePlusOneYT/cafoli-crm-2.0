import AppLayout from "@/components/AppLayout";
import BrevoKeyManager from "@/components/BrevoKeyManager";
import UserManagement from "@/components/admin/UserManagement";
import CreateUserDialog from "@/components/admin/CreateUserDialog";
import AdminActions from "@/components/admin/AdminActions";
import GeminiKeyManager from "@/components/GeminiKeyManager";
import { AllocateColdCallerDialog } from "@/components/admin/AllocateColdCallerDialog";
import { ProductUploadDialog } from "@/components/products/ProductUploadDialog";
import { ProductListManager } from "@/components/products/ProductListManager";
import { RangePdfUploadDialog } from "@/components/products/RangePdfUploadDialog";
import { RangePdfListManager } from "@/components/products/RangePdfListManager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield } from "lucide-react";
import { useQuery, useMutation, useAction } from "convex/react";
import { getConvexApi } from "@/lib/convex-api";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const api = getConvexApi() as any;
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import type { Id } from "@/convex/_generated/dataModel";
import JSZip from "jszip";
import * as Papa from "papaparse";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableBody, TableCell, TableHead } from "@/components/ui/table";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Trash2 } from "lucide-react";

interface User {
  _id: Id<"users">;
  name?: string;
  email?: string;
  role?: "admin" | "staff" | "uploader";
  image?: string;
  _creationTime: number;
}

export default function Admin() {
  const { user: currentUser } = useAuth();
  const users = useQuery(api.users.getAllUsers);
  const createUser = useMutation(api.users.createUser);
  const deleteUser = useMutation(api.users.deleteUser);
  const updateUserRole = useMutation(api.users.updateUserRole);
  const deduplicateLeads = useMutation(api.leads.deduplication.deduplicateLeads);
  
  const [activeTab, setActiveTab] = useState("users");
  const [deduplicationResult, setDeduplicationResult] = useState<any>(null);
  const [isDeduplicating, setIsDeduplicating] = useState(false);
  const [currentProcessId, setCurrentProcessId] = useState<string | null>(null);
  const [batchProcessResult, setBatchProcessResult] = useState<any>(null);
  const clearAllSummaries = useMutation(api.aiMutations.clearAllSummaries);
  const clearAllScores = useMutation(api.aiMutations.clearAllScores);
  const setBatchProcessStop = useMutation(api.aiMutations.setBatchProcessStop);
  const startBatchProcess = useMutation(api.aiMutations.startBatchProcess);

  const batchProgress = useQuery(
    api.aiMutations.getBatchProgress,
    currentProcessId ? { processId: currentProcessId } : "skip"
  );

  const isBatchProcessing = batchProgress?.status === "queued" || batchProgress?.status === "running";

  if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "uploader")) {
    return <div className="p-8 text-center">You do not have permission to view this page.</div>;
  }

  const handleCreateUser = async (userData: {
    email: string;
    name: string;
    password: string;
    role: "admin" | "staff" | "uploader";
  }) => {
    if (!currentUser) return;
    await createUser({
      ...userData,
      adminId: currentUser._id,
    });
  };

  const handleDeduplication = async (dryRun: boolean) => {
    if (!currentUser) return;
    setIsDeduplicating(true);
    setDeduplicationResult(null);
    
    try {
      const result = await deduplicateLeads({
        adminId: currentUser._id,
        dryRun,
      });
      setDeduplicationResult(result);
      
      if (!dryRun) {
        toast.success(`Deduplication complete! Deleted ${result.leadsDeleted} duplicate leads.`);
      } else {
        toast.info(`Dry run complete. Found ${result.duplicatesFound} sets of duplicates.`);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to deduplicate leads");
    } finally {
      setIsDeduplicating(false);
    }
  };

  const handleBatchProcess = async (processType: "summaries" | "scores" | "both") => {
    if (!currentUser) return;
    setBatchProcessResult(null);

    const typeLabel = processType === "both" ? "summaries and scores" : processType;

    try {
      const { processId } = await startBatchProcess({ processType });
      setCurrentProcessId(processId);

      toast.success(`Batch processing started! Processing ${typeLabel} in the background. You can close this tab and it will continue running.`);
    } catch (error: any) {
      toast.error(error.message || "Failed to start batch processing");
    }
  };

  const handleForceStop = async () => {
    if (!currentProcessId) return;

    try {
      await setBatchProcessStop({ processId: currentProcessId });
      toast.info("Stopping batch processing after current batch completes...");
    } catch (error: any) {
      toast.error("Failed to stop batch processing");
    }
  };

  return (
    <AppLayout>
      <div className="container mx-auto py-8 space-y-8">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList>
            {currentUser.role === "admin" && <TabsTrigger value="users">User Management</TabsTrigger>}
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="ranges">Range PDFs</TabsTrigger>
            {currentUser.role === "admin" && <TabsTrigger value="api-keys">API Keys</TabsTrigger>}
            {currentUser.role === "admin" && <TabsTrigger value="ai-batch">AI Batch Processing</TabsTrigger>}
            {currentUser.role === "admin" && <TabsTrigger value="deduplication">Deduplication</TabsTrigger>}
            {currentUser.role === "admin" && <TabsTrigger value="logs">System Logs</TabsTrigger>}
          </TabsList>

          {currentUser.role === "admin" && (
            <TabsContent value="users" className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Users</h2>
                <CreateUserDialog onCreateUser={handleCreateUser} />
              </div>
              
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users?.map((user: any) => (
                      <TableRow key={user._id}>
                        <TableCell className="font-medium">{user.name || "Unknown"}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Select
                            defaultValue={user.role}
                            onValueChange={(value: string) => 
                              updateUserRole({ userId: user._id, role: value })
                            }
                            disabled={user.email === "owner"}
                          >
                            <SelectTrigger className="w-[130px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="staff">Staff</SelectItem>
                              <SelectItem value="uploader">Uploader</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {new Date(user._creationTime).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive/90"
                            onClick={() => {
                              if (confirm("Are you sure you want to delete this user?")) {
                                deleteUser({ userId: user._id, adminId: currentUser._id });
                              }
                            }}
                            disabled={user.email === "owner" || user._id === currentUser._id}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          )}

          <TabsContent value="products">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Product Management</h2>
                <ProductUploadDialog />
              </div>
              <ProductListManager />
            </div>
          </TabsContent>

          <TabsContent value="ranges">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Range PDFs</h2>
                <RangePdfUploadDialog />
              </div>
              <RangePdfListManager />
            </div>
          </TabsContent>

          {currentUser.role === "admin" && (
            <TabsContent value="api-keys" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Brevo API Keys</CardTitle>
                </CardHeader>
                <CardContent>
                  <BrevoKeyManager userId={currentUser._id} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Gemini API Keys</CardTitle>
                </CardHeader>
                <CardContent>
                  <GeminiKeyManager userId={currentUser._id} />
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {currentUser.role === "admin" && (
            <TabsContent value="ai-batch" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>AI Batch Processing</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Process all leads to generate AI summaries and priority scores using Gemma 3 27B IT model.
                    Processing runs in the background - you can close this tab and it will continue. Each available API key processes one lead at a time in parallel.
                    Batches are processed sequentially with a 15-second cooldown between batches. WhatsApp chat history is included in the analysis.
                  </p>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => handleBatchProcess("summaries")}
                      disabled={isBatchProcessing}
                      variant="outline"
                    >
                      {isBatchProcessing ? "Processing..." : "Generate All Summaries"}
                    </Button>
                    <Button
                      onClick={() => handleBatchProcess("scores")}
                      disabled={isBatchProcessing}
                      variant="outline"
                    >
                      {isBatchProcessing ? "Processing..." : "Generate All Scores"}
                    </Button>
                    <Button
                      onClick={() => handleBatchProcess("both")}
                      disabled={isBatchProcessing}
                    >
                      {isBatchProcessing ? "Processing..." : "Generate Both (Summaries + Scores)"}
                    </Button>
                    {isBatchProcessing && (
                      <Button
                        onClick={handleForceStop}
                        variant="destructive"
                        disabled={!currentProcessId}
                      >
                        Force Stop
                      </Button>
                    )}
                  </div>

                  {batchProgress && (batchProgress.status === "queued" || batchProgress.status === "running" || batchProgress.status === "completed" || batchProgress.status === "stopped") && (
                    <div className={`p-4 rounded-md border ${
                      batchProgress.status === "completed" ? "bg-green-50 border-green-200" :
                      batchProgress.status === "stopped" ? "bg-yellow-50 border-yellow-200" :
                      "bg-muted/20"
                    }`}>
                      <h4 className="font-semibold mb-2">
                        Processing Status: {
                          batchProgress.status === "queued" ? "Queued" :
                          batchProgress.status === "running" ? "Running" :
                          batchProgress.status === "completed" ? "Completed" :
                          batchProgress.status === "stopped" ? "Stopped" :
                          "Unknown"
                        }
                      </h4>
                      <div className="space-y-1 text-sm">
                        <p>Processed: {batchProgress.processed}</p>
                        <p>Failed: {batchProgress.failed}</p>
                        <p>Total: {batchProgress.processed + batchProgress.failed}</p>
                      </div>
                      {(batchProgress.status === "queued" || batchProgress.status === "running") && (
                        <p className="text-xs text-muted-foreground mt-2">
                          This process will continue running even if you close this tab.
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 pt-4 border-t">
                    <Button
                      onClick={async () => {
                        if (confirm("Clear all AI summaries? This cannot be undone.")) {
                          await clearAllSummaries();
                          toast.success("All summaries cleared");
                        }
                      }}
                      disabled={isBatchProcessing}
                      variant="destructive"
                      size="sm"
                    >
                      Clear All Summaries
                    </Button>
                    <Button
                      onClick={async () => {
                        if (confirm("Clear all AI scores? This cannot be undone.")) {
                          await clearAllScores();
                          toast.success("All scores cleared");
                        }
                      }}
                      disabled={isBatchProcessing}
                      variant="destructive"
                      size="sm"
                    >
                      Clear All Scores
                    </Button>
                  </div>

                  <div className="mt-4 p-4 bg-muted/20 rounded-md">
                    <h4 className="font-semibold mb-2">How it works:</h4>
                    <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                      <li>Runs in background - close tab anytime, processing continues</li>
                      <li>Each API key processes one lead at a time in parallel</li>
                      <li>Batch size equals number of available Gemini API keys</li>
                      <li>15-second cooldown between batches to prevent rate limiting</li>
                      <li>Force stop available to gracefully halt processing</li>
                      <li>Includes WhatsApp chat history in analysis</li>
                      <li>Summaries use recent comments and messages</li>
                      <li>Scores consider engagement, recency, and AI summary</li>
                      <li>Results are cached to avoid redundant processing</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {currentUser.role === "admin" && (
            <TabsContent value="deduplication" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Lead Deduplication</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    This tool identifies and removes duplicate leads based on phone numbers. 
                    The oldest lead will be kept, and newer duplicates will be deleted.
                  </p>
                  
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleDeduplication(true)}
                      disabled={isDeduplicating}
                      variant="outline"
                    >
                      {isDeduplicating ? "Scanning..." : "Dry Run (Preview)"}
                    </Button>
                    <Button
                      onClick={() => handleDeduplication(false)}
                      disabled={isDeduplicating || !deduplicationResult}
                      variant="destructive"
                    >
                      {isDeduplicating ? "Processing..." : "Delete Duplicates"}
                    </Button>
                  </div>

                  {deduplicationResult && (
                    <Alert className={deduplicationResult.dryRun ? "border-blue-500" : "border-green-500"}>
                      {deduplicationResult.dryRun ? (
                        <AlertCircle className="h-4 w-4" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      <AlertDescription>
                        <div className="space-y-2">
                          <p className="font-semibold">
                            {deduplicationResult.dryRun ? "Preview Results:" : "Deduplication Complete!"}
                          </p>
                          <p>Found {deduplicationResult.duplicatesFound} sets of duplicate leads</p>
                          {deduplicationResult.dryRun ? (
                            <p>Would delete {deduplicationResult.totalLeadsToDelete} duplicate leads</p>
                          ) : (
                            <p>Deleted {deduplicationResult.leadsDeleted} duplicate leads</p>
                          )}
                          
                          {deduplicationResult.duplicates && deduplicationResult.duplicates.length > 0 && (
                            <div className="mt-4 space-y-2">
                              <p className="font-semibold text-sm">Sample duplicates (first 50):</p>
                              <div className="max-h-64 overflow-y-auto space-y-2">
                                {deduplicationResult.duplicates.map((dup: any, idx: number) => (
                                  <div key={idx} className="text-xs bg-muted p-2 rounded">
                                    <p className="font-medium">Phone: {dup.mobile}</p>
                                    <p className="text-muted-foreground">
                                      Keeping: {dup.leads[0].name} (oldest)
                                    </p>
                                    <p className="text-muted-foreground">
                                      {deduplicationResult.dryRun ? "Would delete" : "Deleted"}: {dup.deleteIds.length} duplicate(s)
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
          
          {currentUser.role === "admin" && (
            <TabsContent value="logs">
               <div className="p-4 border rounded bg-muted/20">
                  <p className="text-muted-foreground">System logs are available in the Convex dashboard.</p>
                  <Button variant="outline" className="mt-4" asChild>
                    <a href="https://dashboard.convex.dev" target="_blank" rel="noopener noreferrer">
                      Open Convex Dashboard
                    </a>
                  </Button>
               </div>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </AppLayout>
  );
}