import { useEffect, useRef } from "react";
import {
  ArrowLeftToLine,
  ArrowRightToLine,
  CheckSquare,
  Layers3,
  Pencil,
  SquareDashedMousePointer,
  Trash2,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Z_INDEX } from "../ui/overlay";

interface SlideContextMenuProps {
  open: boolean;
  position: { x: number; y: number };
  selectionCount: number;
  totalSlides: number;
  selectionMode: boolean;
  onRename: () => void;
  onStartSelection: () => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onMoveToStart: () => void;
  onMoveToEnd: () => void;
  onGroup: () => void;
  onDelete: () => void;
  onClose: () => void;
}

function MenuItem({
  icon: Icon,
  label,
  shortcut,
  destructive = false,
  disabled = false,
  onClick,
}: {
  icon: typeof Pencil;
  label: string;
  shortcut?: string;
  destructive?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={
        `flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ` +
        (destructive
          ? "text-destructive hover:bg-destructive/10"
          : "text-foreground hover:bg-muted/70") +
        " disabled:pointer-events-none disabled:opacity-40"
      }
      onClick={onClick}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="flex-1">{label}</span>
      {shortcut && <span className="text-[10px] text-muted-foreground">{shortcut}</span>}
    </button>
  );
}

/** Contextual slide actions with a focused multi-select workflow. */
export function SlideContextMenu({
  open,
  position,
  selectionCount,
  totalSlides,
  selectionMode,
  onRename,
  onStartSelection,
  onSelectAll,
  onClearSelection,
  onMoveToStart,
  onMoveToEnd,
  onGroup,
  onDelete,
  onClose,
}: SlideContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

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
            left: Math.min(position.x, window.innerWidth - 226),
            top: Math.min(position.y, window.innerHeight - 310),
            zIndex: Z_INDEX.contextMenu,
          }}
          initial={{ opacity: 0, scale: 0.96, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -4 }}
          transition={{ duration: 0.14 }}
          role="menu"
          aria-label="Slide actions"
        >
          {!selectionMode ? (
            <>
              <MenuItem icon={Pencil} label="Rename" shortcut="F2" onClick={onRename} />
              <MenuItem icon={CheckSquare} label="Select all slides" onClick={onSelectAll} />
              <MenuItem icon={SquareDashedMousePointer} label="Select multiple" onClick={onStartSelection} />
            </>
          ) : (
            <>
              <div className="flex items-center justify-between px-3 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                <span>{selectionCount} selected</span>
                <button
                  type="button"
                  className="rounded p-0.5 hover:bg-muted hover:text-foreground"
                  onClick={onClearSelection}
                  aria-label="Exit multi-select"
                  title="Exit multi-select"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
              <MenuItem icon={CheckSquare} label="Select all slides" onClick={onSelectAll} />
              <div className="my-1 border-t border-border/60" />
              <MenuItem icon={ArrowLeftToLine} label="Move selected to start" onClick={onMoveToStart} />
              <MenuItem icon={ArrowRightToLine} label="Move selected to end" onClick={onMoveToEnd} />
              <MenuItem icon={Layers3} label="Group selected" disabled={selectionCount < 2} onClick={onGroup} />
              <div className="my-1 border-t border-border/60" />
              <MenuItem
                icon={Trash2}
                label="Delete selected"
                destructive
                disabled={selectionCount === 0 || selectionCount === totalSlides}
                onClick={onDelete}
              />
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
