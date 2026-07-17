/**
 * In-app toolbar strip. Window chrome (traffic lights / caption buttons)
 * is handled by the OS via native decorations — no custom window controls.
 */
import { cn } from "@/lib/utils";

interface TitleBarProps {
  title?: string;
  className?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  /** When true, omit the bottom border (merged into a single bar). */
  borderless?: boolean;
}

export function TitleBar({
  title,
  className,
  leading,
  trailing,
  borderless,
}: TitleBarProps) {
  return (
    <div
      className={cn(
        "flex h-11 shrink-0 items-center justify-between gap-3 bg-card/70 px-3 backdrop-blur-md",
        !borderless && "border-b border-border/60",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        {leading}
        {title && (
          <span className="truncate text-sm font-medium text-foreground/90">{title}</span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">{trailing}</div>
    </div>
  );
}
