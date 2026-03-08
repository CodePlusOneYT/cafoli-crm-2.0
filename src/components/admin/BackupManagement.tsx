import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Upload, AlertTriangle, RefreshCw } from "lucide-react";
import { useConvex, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const TABLES = [
  "users", "tags", "productCategories", "whatsappConfig", "geminiApiKeys", 
  "batchProcessControl", "rangePdfs", "whatsappMediaCache", "r2_leads_mock", 
  "whatsappTemplates", "templates", "products", "brevoApiKeys", "whatsappGroups", 
  "emailTemplates", "quickReplies", "exportLogs", "bulkContacts", "pushSubscriptions", 
  "leads", "campaigns", "coldCallerLeads", "contactRequests", "activityLogs", 
  "activeChatSessions", "chats", "messages", "comments", "leadSummaries", 
  "interventionRequests", "emailEnrollments", "campaignEnrollments", 
  "campaignExecutions", "followups"
];

export function BackupManagement() {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState("");
  
  const convex = useConvex();
  const clearTableBatch = useMutation(api.backup.clearTableBatch);
  const restoreTableBatch = useMutation(api.backup.restoreTableBatch);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const backupData: Record<string, any[]> = {};
      
      for (const table of TABLES) {
        setProgress(`Exporting ${table}...`);
        backupData[table] = [];
        let isDone = false;
        let cursor: string | undefined | null = undefined;
        
        while (!isDone) {
          const result: any = await convex.query(api.backup.getTableDataBatch, { table, cursor });
          backupData[table].push(...result.page);
          isDone = result.isDone;
          cursor = result.continueCursor;
        }
      }
      
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cafoli_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success("Backup downloaded successfully");
    } catch (error: any) {
      toast.error(`Export failed: ${error.message}`);
    } finally {
      setIsExporting(false);
      setProgress("");
    }
  };

  const replaceIds = (obj: any, idMap: Record<string, string>): any => {
    if (typeof obj === 'string') {
      return idMap[obj] || obj;
    }
    if (Array.isArray(obj)) {
      return obj.map(item => replaceIds(item, idMap));
    }
    if (obj !== null && typeof obj === 'object') {
      const newObj: any = {};
      for (const [key, value] of Object.entries(obj)) {
        newObj[key] = replaceIds(value, idMap);
      }
      return newObj;
    }
    return obj;
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!confirm("WARNING: This will DELETE ALL EXISTING DATA and replace it with the backup. This action CANNOT be undone. Are you absolutely sure?")) {
      event.target.value = '';
      return;
    }

    try {
      setIsImporting(true);
      setProgress("Reading backup file...");
      
      const text = await file.text();
      const backupData = JSON.parse(text);
      
      // 1. Clear all tables
      for (const table of [...TABLES].reverse()) {
        setProgress(`Clearing ${table}...`);
        let hasMore = true;
        while (hasMore) {
          hasMore = await clearTableBatch({ table });
        }
      }
      
      // 2. Restore data table by table
      let globalIdMap: Record<string, string> = {};
      
      for (const table of TABLES) {
        if (!backupData[table] || backupData[table].length === 0) continue;
        
        setProgress(`Restoring ${table} (${backupData[table].length} records)...`);
        
        const records = backupData[table];
        
        // Sort messages by creation time to handle self-references (quotedMessageId)
        if (table === "messages") {
          records.sort((a: any, b: any) => a._creationTime - b._creationTime);
        }
        
        // Process in batches of 100
        const BATCH_SIZE = 100;
        for (let i = 0; i < records.length; i += BATCH_SIZE) {
          const batch = records.slice(i, i + BATCH_SIZE);
          
          // Replace IDs in the batch using the global map
          const processedBatch = batch.map((record: any) => replaceIds(record, globalIdMap));
          
          const newIdMap = await restoreTableBatch({ 
            table, 
            records: processedBatch 
          });
          
          // Merge new IDs into global map
          globalIdMap = { ...globalIdMap, ...newIdMap };
        }
      }
      
      toast.success("Data restored successfully!");
      setTimeout(() => window.location.reload(), 2000);
    } catch (error: any) {
      toast.error(`Import failed: ${error.message}`);
      console.error(error);
    } finally {
      setIsImporting(false);
      setProgress("");
      event.target.value = '';
    }
  };

  return (
    <Card className="border-destructive">
      <CardHeader>
        <CardTitle className="text-destructive flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          System Backup & Restore
        </CardTitle>
        <CardDescription>
          Download a complete backup of all system data, or restore from a previous backup.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Warning</AlertTitle>
          <AlertDescription>
            Restoring a backup will <strong>permanently delete</strong> all current data in the system. 
            Please ensure you have a recent backup before proceeding.
          </AlertDescription>
        </Alert>

        <div className="flex flex-col sm:flex-row gap-4">
          <Button 
            onClick={handleExport} 
            disabled={isExporting || isImporting}
            className="w-full sm:w-auto"
          >
            {isExporting ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Download Full Backup
          </Button>

          <div className="relative w-full sm:w-auto">
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              disabled={isExporting || isImporting}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
            />
            <Button 
              variant="destructive" 
              disabled={isExporting || isImporting}
              className="w-full"
            >
              {isImporting ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Restore from Backup
            </Button>
          </div>
        </div>

        {(isExporting || isImporting) && progress && (
          <p className="text-sm font-medium text-muted-foreground animate-pulse">
            {progress}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
