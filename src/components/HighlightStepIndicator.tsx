/**
 * HighlightStepIndicator — small floating pill that shows highlight
 * playback progress for the current slide (●●○ 2/3).
 *
 * Shown in the present overlay and in the editor preview corner whenever
 * the slide has highlights, so the presenter always knows a click/arrow
 * will reveal a highlight instead of moving to the next slide.
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
}

export function HighlightStepIndicator({
  total,
  current,
  compact = false,
  className,
}: HighlightStepIndicatorProps) {
  if (total <= 0) return null;

  const active = current >= 0;
  const shown = Math.min(current + 1, total);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "pointer-events-none inline-flex select-none items-center gap-2 rounded-full",
        "bg-black/55 text-white/90 shadow-lg backdrop-blur-sm",
        compact ? "px-2 py-1" : "px-3 py-1.5",
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
        {Array.from({ length: total }, (_, i) => (
          <motion.span
            key={i}
            className={cn(
              "rounded-full",
              compact ? "h-1.5 w-1.5" : "h-2 w-2",
            )}
            initial={false}
            animate={{
              scale: i === current ? 1.35 : 1,
              opacity: i <= current ? 1 : 0.35,
              backgroundColor: i <= current ? "#fcd34d" : "#ffffff",
            }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          />
        ))}
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
          )}
        >
          {active ? `${shown}/${total}` : `→ ${total}`}
        </motion.span>
      </AnimatePresence>
    </motion.div>
  );
}
