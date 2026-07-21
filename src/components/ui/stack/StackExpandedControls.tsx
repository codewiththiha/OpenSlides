import { Ungroup, X } from "lucide-react";
import { Button } from "../button";
import { cn } from "@/lib/utils";

export interface StackExpandedControlsProps {
  count: number;
  onUngroup: () => void;
  onClose: () => void;
  variant?: "dashboard" | "slide-strip";
  className?: string;
}

/**
 * Shared expanded controls for fanned stacks (`Ungroup (n)` + close `X` buttons).
 */
export function StackExpandedControls({
  count,
  onUngroup,
  onClose,
  variant = "dashboard",
  className,
}: StackExpandedControlsProps) {
  if (variant === "slide-strip") {
    return (
      <div className={cn("flex flex-col gap-1 border-r border-border/60 pr-2", className)}>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 gap-1 px-2 text-[11px] font-semibold text-primary hover:bg-primary/20"
          onClick={onUngroup}
          title="Ungroup slide section"
        >
          <Ungroup className="h-3 w-3" />
          Ungroup
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 self-center text-muted-foreground hover:text-foreground"
          onClick={onClose}
          title="Collapse section fan"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Button
        size="sm"
        variant="secondary"
        className="gap-2 rounded-full border border-border bg-card px-5 py-2 shadow-xl hover:bg-accent hover:text-accent-foreground"
        onClick={onUngroup}
      >
        <Ungroup className="h-4 w-4" />
        Ungroup ({count})
      </Button>
      <Button
        size="icon"
        variant="outline"
        className="h-9 w-9 rounded-full border border-border bg-card shadow-xl hover:bg-accent"
        onClick={onClose}
        aria-label="Close stack fan"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
