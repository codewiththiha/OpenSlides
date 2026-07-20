import { useEffect } from "react";
import { cn } from "@/lib/utils";

export const OVERLAY_Z = { drawer: 40, contextMenu: 100, command: 200, shortcuts: 210, tooltip: 300 } as const;

export function Overlay({ onClose, z = OVERLAY_Z.command, placement = "center", closeOnEsc = false, className, children }: { onClose: () => void; z?: number; placement?: "center" | "top"; closeOnEsc?: boolean; className?: string; children: React.ReactNode }) {
  useEffect(() => {
    if (!closeOnEsc) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeOnEsc, onClose]);
  return <div className={cn("fixed inset-0 flex bg-black/50 backdrop-blur-sm", placement === "center" ? "items-center justify-center p-4" : "items-start justify-center pt-[15vh]")} style={{ zIndex: z }}><div className="absolute inset-0" onClick={onClose} /><div className={cn("relative", className)}>{children}</div></div>;
}
