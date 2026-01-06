import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { getConvexApi } from "@/lib/convex-api";

const api = getConvexApi() as any;
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Loader2, Plus, Upload, X, FileText, Edit } from "lucide-react";

interface RangePdfUploadDialogProps {
  disabled?: boolean;
  rangePdf?: any;
  trigger?: React.ReactNode;
}

export function RangePdfUploadDialog({ disabled, rangePdf, trigger }: RangePdfUploadDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [division, setDivision] = useState("");
  const [category, setCategory] = useState("DIVISION"); // "DIVISION" or "THERAPEUTIC"
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  const generateUploadUrl = useMutation(api.rangePdfs.generateUploadUrl);
  const createRangePdf = useMutation(api.rangePdfs.createRangePdf);
  const updateRangePdf = useMutation(api.rangePdfs.updateRangePdf);

  useEffect(() => {
    if (rangePdf && open) {
      setName(rangePdf.name || "");
      setDivision(rangePdf.division || "");
      setCategory(rangePdf.category || "DIVISION");
    } else if (!rangePdf && open) {
      setName("");
      setDivision("");
      setCategory("DIVISION");
      setSelectedFile(null);
    }
  }, [rangePdf, open]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type !== "application/pdf") {
        toast.error("Please upload a PDF file");
        return;
      }
      setSelectedFile(file);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name) {
      toast.error("Please fill in name");
      return;
    }

    if (!rangePdf && !selectedFile) {
      toast.error("Please select a PDF");
      return;
    }

    if (category === "DIVISION" && !division) {
      toast.error("Please enter a division name");
      return;
    }

    setLoading(true);
    try {
      let storageId = undefined;
      if (selectedFile) {
        // Upload PDF
        const postUrl = await generateUploadUrl();
        const result = await fetch(postUrl, {
          method: "POST",
          headers: { "Content-Type": selectedFile.type },
          body: selectedFile,
        });
        const json = await result.json();
        storageId = json.storageId;
      }

      if (rangePdf) {
        await updateRangePdf({
          id: rangePdf._id,
          name,
          division: category === "DIVISION" ? division : undefined,
          category,
          storageId,
        });
        toast.success("Range PDF updated successfully");
      } else {
        await createRangePdf({
          name,
          division: category === "DIVISION" ? division : undefined,
          category,
          storageId: storageId!,
        });
        toast.success("Range PDF uploaded successfully");
      }

      setOpen(false);
      if (!rangePdf) {
        setName("");
        setDivision("");
        setCategory("DIVISION");
        setSelectedFile(null);
      }
    } catch (error) {
      console.error(error);
      toast.error(rangePdf ? "Failed to update Range PDF" : "Failed to upload Range PDF");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ? trigger : (
          <Button 
            variant="outline" 
            className="w-full justify-start gap-2"
            disabled={disabled}
          >
            <Plus className="h-4 w-4" />
            Upload Range PDF
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{rangePdf ? "Edit Range PDF" : "Upload Range PDF"}</DialogTitle>
          <DialogDescription>
            {rangePdf ? "Update range PDF details." : "Add a new product range PDF catalog."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Range Type</Label>
            <RadioGroup defaultValue="DIVISION" value={category} onValueChange={setCategory} className="flex gap-4">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="DIVISION" id="r1" />
                <Label htmlFor="r1">Division Range</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="THERAPEUTIC" id="r2" />
                <Label htmlFor="r2">Therapeutic Range</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Range Name *</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Cardiac Range" />
          </div>
          
          {category === "DIVISION" && (
            <div className="space-y-2">
              <Label htmlFor="division">Division *</Label>
              <Input id="division" value={division} onChange={(e) => setDivision(e.target.value)} required placeholder="e.g. Main Division" />
            </div>
          )}

          <div className="space-y-2">
            <Label>PDF File {rangePdf ? "(Optional)" : "*"}</Label>
            {selectedFile ? (
              <div className="relative bg-muted p-3 rounded-md flex items-center gap-3">
                <FileText className="h-5 w-5 text-blue-500" />
                <span className="text-sm truncate flex-1">{selectedFile.name}</span>
                <button type="button" onClick={removeFile} className="text-destructive hover:text-destructive/80">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {rangePdf && (
                  <div className="text-xs text-muted-foreground">
                    Current file: <span className="font-medium">Existing PDF</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept="application/pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="pdf-upload"
                  />
                  <Label
                    htmlFor="pdf-upload"
                    className="flex items-center gap-2 px-4 py-2 border rounded-md cursor-pointer hover:bg-muted w-full justify-center"
                  >
                    <Upload className="h-4 w-4" />
                    {rangePdf ? "Replace PDF" : "Select PDF"}
                  </Label>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {rangePdf ? "Update PDF" : "Upload PDF"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}