import { ArrowLeftToLine, ArrowRightToLine, Layers3, Trash2, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Z_INDEX } from "../ui/overlay";

interface SlideSelectionToolbarProps {
  open: boolean;
  selectionCount: number;
  totalSlides: number;
  onMoveToStart: () => void;
  onMoveToEnd: () => void;
  onGroup: () => void;
  onDelete: () => void;
  onCancel: () => void;
}

function BubbleButton({
  label,
  icon: Icon,
  disabled = false,
  destructive = false,
  onClick,
}: {
  label: string;
  icon: typeof X;
  disabled?: boolean;
  destructive?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={label}
      aria-label={label}
      className={
        "flex h-8 w-8 items-center justify-center rounded-full transition-colors " +
        (destructive
          ? "text-destructive hover:bg-destructive/12"
          : "text-muted-foreground hover:bg-muted hover:text-foreground") +
        " disabled:pointer-events-none disabled:opacity-35"
      }
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

/** Persistent batch controls for selected slide cards. */
export function SlideSelectionToolbar({
  open,
  selectionCount,
  totalSlides,
  onMoveToStart,
  onMoveToEnd,
  onGroup,
  onDelete,
  onCancel,
}: SlideSelectionToolbarProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed bottom-[18px] right-[18px] flex items-center gap-1 rounded-full border border-border/80 bg-card/95 p-1.5 shadow-xl backdrop-blur-md"
          style={{ zIndex: Z_INDEX.contextMenu }}
          initial={{ opacity: 0, y: 12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.96 }}
          transition={{ duration: 0.16 }}
          role="toolbar"
          aria-label="Selected slide actions"
        >
          <span className="min-w-8 px-1 text-center text-[11px] font-semibold tabular-nums text-foreground" title={`${selectionCount} slides selected`}>
            {selectionCount}
          </span>
          <span className="h-5 w-px bg-border/70" />
          <BubbleButton label="Move selected to start" icon={ArrowLeftToLine} onClick={onMoveToStart} />
          <BubbleButton label="Move selected to end" icon={ArrowRightToLine} onClick={onMoveToEnd} />
          <BubbleButton label="Group selected" icon={Layers3} disabled={selectionCount < 2} onClick={onGroup} />
          <BubbleButton
            label="Delete selected"
            icon={Trash2}
            destructive
            disabled={selectionCount === 0 || selectionCount === totalSlides}
            onClick={onDelete}
          />
          <span className="h-5 w-px bg-border/70" />
          <BubbleButton label="Cancel selection (Esc)" icon={X} onClick={onCancel} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
