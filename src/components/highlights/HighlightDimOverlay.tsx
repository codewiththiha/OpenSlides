import { motion } from "framer-motion";

import { EASE_DIM } from "./easings";


interface HighlightDimOverlayProps {
  dimAmount: number;
  dimDuration: number;
}

export function HighlightDimOverlay({ dimAmount, dimDuration }: HighlightDimOverlayProps) {
  return (
    <motion.div
      key="hl-dim"
      className="pointer-events-none absolute inset-0 z-20"
      style={{ backgroundColor: "rgba(0, 0, 0, 1)", willChange: "opacity" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: dimAmount }}
      exit={{ opacity: 0 }}
      transition={{ duration: dimDuration, ease: EASE_DIM }}
    />
  );
}
