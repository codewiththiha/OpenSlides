/**
 * Custom context menu that appears when highlight mode is enabled
 * and the user right-clicks with text selected in the code editor.
 */
import { useEffect, useRef } from "react";
import { Highlighter as HighlightIcon, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface HighlightContextMenuProps {
  /** Whether the menu is visible */
  visible: boolean;
  /** Position where the menu should appear */
  position: { x: number; y: number };
  /** Callback when "Add Highlight" is clicked */
  onAddHighlight: () => void;
  /** Callback to close the menu */
  onClose: () => void;
}

export function HighlightContextMenu({
  visible,
  position,
  onAddHighlight,
  onClose,
}: HighlightContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    // Delay adding listeners to avoid the right-click itself closing the menu
    const t = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }, 50);

    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [visible, onClose]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          ref={menuRef}
          className="fixed z-[100] min-w-[180px] rounded-lg border border-border/80 bg-card/95 py-1 shadow-xl backdrop-blur-md"
          style={{
            left: position.x,
            top: position.y,
          }}
          initial={{ opacity: 0, scale: 0.95, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -4 }}
          transition={{ duration: 0.15 }}
        >
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-muted/60 transition-colors"
            onClick={() => {
              onAddHighlight();
              onClose();
            }}
          >
            <HighlightIcon className="h-3.5 w-3.5 text-primary" />
            <span>Add Highlight</span>
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted/60 transition-colors"
            onClick={onClose}
          >
            <X className="h-3.5 w-3.5" />
            <span>Cancel</span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
