import { motion } from "framer-motion";
import type { HighlightMeasurement } from "@/lib/highlight-utils";

export const EASE_DIM = [0.25, 0.1, 0.25, 1] as const;
export const EASE_SCALE = [0.34, 1.56, 0.64, 1] as const;

interface HighlightCloneLayerProps {
  highlightId: string;
  measurement: HighlightMeasurement;
  union: { x: number; y: number; width: number; height: number };
  fontSize: number;
  lineHeight: number;
  scaleTarget: number;
  dimDuration: number;
  sizeDuration: number;
}

export function HighlightCloneLayer({
  highlightId,
  measurement,
  union,
  fontSize,
  lineHeight,
  scaleTarget,
  dimDuration,
  sizeDuration,
}: HighlightCloneLayerProps) {
  return (
    <motion.div
      key={`${highlightId}-clone`}
      className="pointer-events-none absolute z-20 font-mono font-medium tracking-wide"
      style={{
        left: union.x,
        top: union.y,
        width: union.width,
        height: union.height,
        fontSize: `${fontSize}px`,
        lineHeight: lineHeight.toString(),
        transformOrigin: "center center",
        willChange: "transform, opacity",
        transform: "translateZ(0)",
      }}
      initial={{ scale: 1, opacity: 0 }}
      animate={{ scale: scaleTarget, opacity: 1 }}
      exit={{ scale: 1, opacity: 0 }}
      transition={{
        scale: { duration: sizeDuration, ease: EASE_SCALE },
        opacity: { duration: dimDuration, ease: EASE_DIM },
      }}
    >
      {measurement.segments.map((seg) => (
        <pre
          key={seg.line.lineIndex}
          className="absolute whitespace-pre"
          style={{
            left: seg.rect.x - union.x,
            top: seg.rect.y - union.y,
            margin: 0,
            padding: 0,
            background: "transparent",
            fontFamily: "inherit",
            fontSize: "inherit",
            lineHeight: "inherit",
            letterSpacing: "inherit",
          }}
          dangerouslySetInnerHTML={{
            __html: seg.line.html,
          }}
        />
      ))}
    </motion.div>
  );
}
