import { Loader2, Check, AlertCircle } from "lucide-react";

interface SaveStatusBadgeProps {
  status: "idle" | "saving" | "saved" | "error";
}

export function SaveStatusBadge({ status }: SaveStatusBadgeProps) {
  switch (status) {
    case "saving":
      return (
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Saving…
        </span>
      );
    case "saved":
      return (
        <span className="flex items-center gap-1 text-[11px] text-emerald-500">
          <Check className="h-3 w-3" /> Saved
        </span>
      );
    case "error":
      return (
        <span className="flex items-center gap-1 text-[11px] text-destructive">
          <AlertCircle className="h-3 w-3" /> Save failed
        </span>
      );
    default:
      return null;
  }
}
