import { cn } from "@/lib/utils";

/**
 * Wrapper that reveals its children on hover via `group-hover:opacity-100`.
 * The parent card must have the `group` class.
 */
interface HoverActionsProps {
  children: React.ReactNode;
  className?: string;
}

export function HoverActions({
  children,
  className,
}: HoverActionsProps) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * A hover-revealed action button used inside `<HoverActions>`.
 *
 * By convention, the caller's `onClick` should call `e.stopPropagation()`
 * to prevent the parent card's click handler from firing. This component
 * does NOT force stopPropagation — the caller owns it.
 */
interface HoverActionButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  destructive?: boolean;
  size?: "sm" | "md";
}

export function HoverActionButton({
  destructive = false,
  size = "sm",
  className,
  ...props
}: HoverActionButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        size === "sm" &&
          "rounded p-0.5 text-muted-foreground",
        size === "md" &&
          "inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground",
        size === "sm" &&
          !destructive &&
          "hover:bg-muted",
        size === "md" &&
          !destructive &&
          "hover:bg-accent hover:text-accent-foreground",
        destructive &&
          "hover:bg-destructive/10 hover:text-destructive",
        className,
      )}
      {...props}
    />
  );
}
