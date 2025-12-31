import { useRouteError, isRouteErrorResponse, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function ErrorBoundary() {
  const error = useRouteError();
  const navigate = useNavigate();

  console.error("ErrorBoundary caught error:", error);

  let errorMessage = "An unexpected error occurred.";
  let errorDetails = "";

  if (isRouteErrorResponse(error)) {
    errorMessage = `${error.status} ${error.statusText}`;
    errorDetails = error.data?.message || "Page not found or access denied.";
  } else if (error instanceof Error) {
    errorMessage = error.message;
    errorDetails = error.stack || "";
  } else if (typeof error === "string") {
    errorMessage = error;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background text-foreground">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="h-24 w-24 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-12 w-12 text-destructive" />
          </div>
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Oops! Something went wrong</h1>
          <p className="text-muted-foreground">
            We encountered an error while processing your request.
          </p>
        </div>

        <div className="bg-muted/50 p-4 rounded-lg text-left overflow-auto max-h-48 text-xs font-mono border">
          <p className="font-semibold text-destructive mb-1">{errorMessage}</p>
          {errorDetails && <p className="text-muted-foreground whitespace-pre-wrap">{errorDetails}</p>}
        </div>

        <div className="flex gap-4 justify-center">
          <Button variant="outline" onClick={() => navigate(-1)}>
            Go Back
          </Button>
          <Button onClick={() => navigate("/")}>
            Back to Home
          </Button>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            Reload Page
          </Button>
        </div>
      </div>
    </div>
  );
}
