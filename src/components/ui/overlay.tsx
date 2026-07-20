import { useEffect } from "react";
import { cn } from "@/lib/utils";

export const OVERLAY_Z = {
  editorExpanded: 90,
  drawerBackdrop: 40,
  drawer: 50,
  contextMenu: 100,
  presentation: 100,
  presentationControls: 110,
  presentationProgress: 120,
  hoverPreview: 200,
  command: 200,
  shortcuts: 210,
  tooltip: 300,
} as const;

export const Z_INDEX = OVERLAY_Z;

export function Overlay({ onClose, z = OVERLAY_Z.command, placement = "center", closeOnEsc = false, className, children }: { onClose: () => void; z?: number; placement?: "center" | "top"; closeOnEsc?: boolean; className?: string; children: React.ReactNode }) {
  useEffect(() => {
    if (!closeOnEsc) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeOnEsc, onClose]);
  return <div className={cn("fixed inset-0 flex bg-black/50 backdrop-blur-sm", placement === "center" ? "items-center justify-center p-4" : "items-start justify-center pt-[15vh]")} style={{ zIndex: z }}><div className="absolute inset-0" onClick={onClose} /><div className={cn("relative", className)}>{children}</div></div>;
}
