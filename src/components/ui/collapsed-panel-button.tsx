import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface CollapsedPanelButtonProps {
  /** vertical = side rail (Code), horizontal = bottom bar (Slides) */
  orientation: "vertical" | "horizontal";
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  title?: string;
  className?: string;
}

export function CollapsedPanelButton({
  orientation,
  icon: Icon,
  label,
  onClick,
  title,
  className,
}: CollapsedPanelButtonProps) {
  return (
    <div
      className={cn(
        orientation === "vertical" &&
          "flex h-full w-full min-w-[28px] cursor-pointer flex-col items-center justify-center gap-2 border-l border-border/50 bg-card/60 hover:bg-muted/40",
        orientation === "horizontal" &&
          "flex h-full min-h-[36px] w-full cursor-pointer items-center justify-center bg-card/60 px-2 hover:bg-muted/30",
        className,
      )}
      onClick={onClick}
      title={title}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span
        className={cn(
          "select-none text-muted-foreground",
          orientation === "vertical" && "text-[11px] tracking-wide",
          orientation === "horizontal" && "text-xs",
        )}
        style={
          orientation === "vertical"
            ? { writingMode: "vertical-rl" as const, textOrientation: "mixed" as const }
            : undefined
        }
      >
        {label}
      </span>
    </div>
  );
}
