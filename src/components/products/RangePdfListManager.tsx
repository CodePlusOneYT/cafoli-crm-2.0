import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Trash2, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { Id } from "@/convex/_generated/dataModel";
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

export function RangePdfListManager() {
  const rangePdfs = useQuery(api.rangePdfs.listRangePdfs);
  const deleteRangePdf = useMutation(api.rangePdfs.deleteRangePdf);
  const [deletingId, setDeletingId] = useState<Id<"rangePdfs"> | null>(null);

  const handleDelete = async (id: Id<"rangePdfs">) => {
    setDeletingId(id);
    try {
      await deleteRangePdf({ id });
      toast.success("Range PDF deleted successfully");
    } catch (error) {
      toast.error("Failed to delete Range PDF");
    } finally {
      setDeletingId(null);
    }
  };

  if (rangePdfs === undefined) {
    return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Division</TableHead>
            <TableHead>File</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rangePdfs.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                No range PDFs uploaded yet.
              </TableCell>
            </TableRow>
          ) : (
            rangePdfs.map((pdf) => (
              <TableRow key={pdf._id}>
                <TableCell className="font-medium">{pdf.name}</TableCell>
                <TableCell>{pdf.division}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">PDF Document</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/90">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Range PDF?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete the PDF for "{pdf.name}". This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={() => handleDelete(pdf._id)}
                          className="bg-destructive hover:bg-destructive/90"
                        >
                          {deletingId === pdf._id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Delete"
                          )}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
