/**
 * HighlightStepIndicator — small floating pill that shows highlight
 * playback progress for the current slide (●●○ 2/3).
 *
 * Shown in the present overlay and in the editor preview corner whenever
 * the slide has highlights, so the presenter always knows a click/arrow
 * will reveal a highlight instead of moving to the next slide.
 *
 * Enhancement: dots are now clickable (pointer-events-auto) to jump directly
 * to a highlight step, plus number keys 1-9 via useEditorKeyboard.
 */
import { motion, AnimatePresence } from "framer-motion";
import { Highlighter as HighlighterIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface HighlightStepIndicatorProps {
  /** Total highlights on the current slide. */
  total: number;
  /** Active highlight index (-1 = none revealed yet). */
  current: number;
  /** Compact styling for the small editor preview. */
  compact?: boolean;
  className?: string;
  /** Called when user clicks a dot to jump to that step. */
  onSelect?: (index: number) => void;
}

export function HighlightStepIndicator({
  total,
  current,
  compact = false,
  className,
  onSelect,
}: HighlightStepIndicatorProps) {
  if (total <= 0) return null;

  const active = current >= 0;
  const shown = Math.min(current + 1, total);
  const interactive = typeof onSelect === "function";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "inline-flex select-none items-center gap-2 rounded-full",
        "bg-black/55 text-white/90 shadow-lg backdrop-blur-sm",
        "border border-white/10",
        compact ? "px-2 py-1" : "px-3 py-1.5",
        interactive ? "pointer-events-auto" : "pointer-events-none",
        className,
      )}
      role="status"
      aria-label={
        active
          ? `Highlight ${shown} of ${total}`
          : `${total} highlight${total > 1 ? "s" : ""} — press → to reveal`
      }
    >
      <HighlighterIcon
        className={cn(
          compact ? "h-3 w-3" : "h-3.5 w-3.5",
          active ? "text-amber-300" : "text-white/60",
        )}
      />
      <span className="flex items-center gap-1">
        {Array.from({ length: total }, (_, i) => {
          const isActive = i === current;
          const isPast = i < current;
          const isFuture = i > current;
          return (
            <motion.button
              key={i}
              type="button"
              disabled={!interactive}
              onClick={() => {
                if (!interactive) return;
                // Clicking current dot toggles back to clean? No, stay. Jump directly.
                onSelect?.(i);
              }}
              title={
                interactive
                  ? `Jump to highlight ${i + 1} of ${total}`
                  : undefined
              }
              className={cn(
                "rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/50 focus-visible:ring-offset-0",
                compact ? "h-3 w-3" : "h-4 w-4",
                "flex items-center justify-center",
                interactive
                  ? "cursor-pointer hover:scale-125 transition-transform"
                  : "cursor-default",
              )}
              aria-label={`Go to highlight ${i + 1}`}
              aria-current={isActive ? "step" : undefined}
            >
              <motion.span
                className={cn(
                  "rounded-full",
                  compact ? "h-1.5 w-1.5" : "h-2 w-2",
                )}
                initial={false}
                animate={{
                  scale: isActive ? 1.35 : 1,
                  opacity: isFuture ? 0.35 : 1,
                  backgroundColor: isPast || isActive ? "#fcd34d" : "#ffffff",
                }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            </motion.button>
          );
        })}
      </span>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={active ? `on-${shown}` : "off"}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.15 }}
          className={cn(
            "font-mono leading-none tabular-nums",
            compact ? "text-[9px]" : "text-[11px]",
            active ? "text-amber-200" : "text-white/60",
            interactive && "cursor-pointer hover:text-amber-100",
          )}
          onClick={() => {
            if (!interactive) return;
            // Clicking counter jumps to clean state (-1) if already active, else stays?
            // For UX: clicking counter when active clears to 0? Let's make it toggle clean when on last?
            // Simpler: clicking counter when active goes to clean (-1), when clean goes to first.
            if (active) {
              onSelect?.(-1);
            } else if (total > 0) {
              onSelect?.(0);
            }
          }}
          title={interactive ? (active ? "Back to clean slide" : "Reveal first highlight") : undefined}
        >
          {active ? `${shown}/${total}` : `→ ${total}`}
        </motion.span>
      </AnimatePresence>
    </motion.div>
  );
}
