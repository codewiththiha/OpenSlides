import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "muted" | "primary";
}

export function Badge({ variant = "muted", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        variant === "muted" &&
          "rounded-md bg-muted px-2 py-1 text-xs font-medium text-foreground/70",
        variant === "primary" &&
          "inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-[3px] text-[8px] font-semibold leading-none text-primary/70",
        className,
      )}
      {...props}
    />
  );
}
