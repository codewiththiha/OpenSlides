import { motion } from "framer-motion";
import type { HighlightMeasurement } from "@/lib/highlight-utils";
import type { HighlightPlan } from "@/lib/highlight-tokens";
import { EASE_DIM } from "./easings";



interface HighlightEraserSegmentsProps {
  highlightId: string;
  measurement: HighlightMeasurement;
  plan: HighlightPlan;
  dimDuration: number;
}

export function HighlightEraserSegments({
  highlightId,
  measurement,
  plan,
  dimDuration,
}: HighlightEraserSegmentsProps) {
  return (
    <>
      {measurement.segments.map((seg) => (
        <motion.div
          key={`${highlightId}-eraser-${seg.line.lineIndex}`}
          className="pointer-events-none absolute z-20"
          style={{
            left: seg.rect.x,
            top: seg.rect.y,
            width: seg.rect.width,
            height: seg.rect.height,
            backgroundColor: plan.eraserColor,
            willChange: "opacity",
            transform: "translateZ(0)",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: dimDuration, ease: EASE_DIM }}
        />
      ))}
    </>
  );
}
