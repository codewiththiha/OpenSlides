import { cn } from "@/lib/utils";

export interface StackLayersProps {
  count?: number;
  hovered?: boolean;
  className?: string;
  variant?: "project" | "slide";
}

export function StackLayers({
  count = 1,
  hovered = false,
  className,
  variant = "project",
}: StackLayersProps) {
  if (count <= 1) return null;

  const isSlide = variant === "slide";

  return (
    <div className={cn("pointer-events-none absolute inset-0 -z-10", className)}>
      {/* Second ghost layer (bottom of pile, visible when count >= 3) */}
      {count >= 3 && (
        <div
          className={cn(
            "absolute inset-0 rounded-xl border border-border/80 bg-card shadow-sm transition-all duration-300 ease-out",
            isSlide
              ? hovered
                ? "rotate-[-4deg] -translate-x-2.5 translate-y-1 scale-95"
                : "rotate-[-2deg] -translate-x-1.5 translate-y-0.5 scale-[0.98]"
              : hovered
              ? "rotate-[-5deg] -translate-x-3.5 translate-y-1.5 scale-95 shadow-md"
              : "rotate-[-3deg] -translate-x-2 translate-y-1 scale-[0.98]"
          )}
        />
      )}
      {/* First ghost layer (middle of pile, visible when count >= 2) */}
      <div
        className={cn(
          "absolute inset-0 rounded-xl border border-border/90 bg-card shadow-sm transition-all duration-300 ease-out",
          isSlide
            ? hovered
              ? "rotate-[4deg] translate-x-2.5 translate-y-1 scale-95"
              : "rotate-[2deg] translate-x-1.5 translate-y-0.5 scale-[0.98]"
            : hovered
            ? "rotate-[5deg] translate-x-3.5 translate-y-1.5 scale-95 shadow-md"
            : "rotate-[3deg] translate-x-2 translate-y-1 scale-[0.98]"
        )}
      />
    </div>
  );
}
