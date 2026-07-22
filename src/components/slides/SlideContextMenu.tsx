import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CheckSquare, Pencil, SquareDashedMousePointer } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Z_INDEX } from "../ui/overlay";

interface SlideContextMenuProps {
  open: boolean;
  position: { x: number; y: number };
  onRename: () => void;
  onStartSelection: () => void;
  onSelectAll: () => void;
  onClose: () => void;
}

function MenuItem({
  icon: Icon,
  label,
  shortcut,
  onClick,
}: {
  icon: typeof Pencil;
  label: string;
  shortcut?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted/70"
      onClick={onClick}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="flex-1">{label}</span>
      {shortcut && <span className="text-[10px] text-muted-foreground">{shortcut}</span>}
    </button>
  );
}

/** Right-click menu for entering a slide-selection workflow. */
export function SlideContextMenu({
  open,
  position,
  onRename,
  onStartSelection,
  onSelectAll,
  onClose,
}: SlideContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [resolvedPosition, setResolvedPosition] = useState({ x: -9999, y: -9999 });
  const [isPositioned, setIsPositioned] = useState(false);

  useLayoutEffect(() => {
    if (!open || !menuRef.current) return;
    setIsPositioned(false);
    const rect = menuRef.current.getBoundingClientRect();
    const gap = 8;
    const edge = 8;
    let left = position.x + gap;
    let top = position.y - rect.height - gap;
    if (left + rect.width > window.innerWidth - edge) {
      left = Math.max(edge, window.innerWidth - rect.width - edge);
    }
    if (top < edge) top = Math.min(window.innerHeight - rect.height - edge, position.y + gap);
    setResolvedPosition({ x: left, y: top });
    setIsPositioned(true);
  }, [open, position]);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const timer = window.setTimeout(() => {
      document.addEventListener("mousedown", dismiss);
      document.addEventListener("keydown", onKeyDown);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("mousedown", dismiss);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={menuRef}
          className="fixed min-w-[210px] overflow-hidden rounded-lg border border-border/80 bg-card/95 py-1 shadow-xl backdrop-blur-md"
          style={{
            left: resolvedPosition.x,
            top: resolvedPosition.y,
            visibility: isPositioned ? "visible" : "hidden",
            zIndex: Z_INDEX.contextMenu,
          }}
          initial={{ opacity: 0, scale: 0.96, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -4 }}
          transition={{ duration: 0.14 }}
          role="menu"
          aria-label="Slide actions"
        >
          <MenuItem icon={Pencil} label="Rename" shortcut="F2" onClick={onRename} />
          <MenuItem icon={CheckSquare} label="Select all slides" onClick={onSelectAll} />
          <MenuItem icon={SquareDashedMousePointer} label="Select multiple" onClick={onStartSelection} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
