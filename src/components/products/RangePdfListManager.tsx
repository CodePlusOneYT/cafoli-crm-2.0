import { useQuery, useMutation } from "convex/react";
import { getConvexApi } from "@/lib/convex-api";

const api = getConvexApi() as any;
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Trash2, FileText, Download, Edit } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { RangePdfUploadDialog } from "./RangePdfUploadDialog";

export function RangePdfListManager() {
  const rangePdfs = useQuery(api.rangePdfs.listRangePdfs) || [];
  const deleteRangePdf = useMutation(api.rangePdfs.deleteRangePdf);
  const getUrl = useMutation(api.products.generateUploadUrl); // We can't get URL directly from here easily without a query, but we can use the storage ID to construct a URL or use a query.

  const handleDelete = async (id: any) => {
    try {
      await deleteRangePdf({ id });
      toast.success("Range PDF deleted successfully");
    } catch (error) {
      toast.error("Failed to delete Range PDF");
      console.error(error);
    }
  };

  return (
    <ScrollArea className="h-[600px] pr-4">
      <div className="space-y-3">
        {rangePdfs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-2 opacity-20" />
            <p>No range PDFs uploaded yet</p>
          </div>
        ) : (
          rangePdfs.map((pdf: any) => (
            <div key={pdf._id} className="flex items-center justify-between p-4 border rounded-lg bg-card text-card-foreground shadow-sm">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{pdf.name}</h3>
                    <Badge variant="outline" className="text-xs">
                      {pdf.category === "THERAPEUTIC" ? "Therapeutic" : "Division"}
                    </Badge>
                  </div>
                  {pdf.division && (
                    <p className="text-sm text-muted-foreground">
                      Division: {pdf.division}
                    </p>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <RangePdfUploadDialog 
                  rangePdf={pdf}
                  trigger={
                    <Button variant="ghost" size="icon" className="text-primary hover:text-primary/80">
                      <Edit className="h-4 w-4" />
                    </Button>
                  }
                />

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive/80"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Range PDF</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete "{pdf.name}"? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDelete(pdf._id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))
        )}
      </div>
    </ScrollArea>
  );
}