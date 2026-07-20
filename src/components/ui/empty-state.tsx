import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
  compact = false,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  children?: React.ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center", compact ? "py-10" : "rounded-2xl border-2 border-dashed border-muted bg-muted/20 py-24", className)}>
      <div className={cn("mb-4 flex items-center justify-center rounded-full bg-muted", compact ? "h-10 w-10" : "h-16 w-16")}>
        <Icon className={cn("text-muted-foreground", compact ? "h-5 w-5" : "h-8 w-8")} />
      </div>
      <h2 className={cn("mb-2 font-semibold", compact ? "text-sm" : "text-xl")}>{title}</h2>
      {description && <p className={cn("max-w-sm text-muted-foreground", compact ? "mb-3 text-xs" : "mb-5")}>{description}</p>}
      {children && <div className="flex gap-2">{children}</div>}
    </div>
  );
}
