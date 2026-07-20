import { cn } from "@/lib/utils";

export function Kbd({ children, tone = "default", className }: { children: React.ReactNode; tone?: "default" | "onDark"; className?: string }) {
  return <kbd className={cn("inline-flex min-w-[1.5rem] items-center justify-center rounded px-1.5 py-0.5 font-mono text-[11px]", tone === "onDark" ? "bg-white/20 text-white" : "border border-border bg-muted text-foreground shadow-sm", className)}>{children}</kbd>;
}
