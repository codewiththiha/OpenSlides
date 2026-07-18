/**
 * HighlightLayer — renders the highlight effect overlay on a slide preview.
 *
 * Layering (bottom to top):
 *   1. shiki-magic-move code (always rendered underneath, untouched)
 *   2. Dim overlay covering the whole slide card (persists across steps)
 *   3. Per-line "eraser" boxes over the selected text (dimmed card color)
 *   4. Clone text (syntax-highlighted, pixel-aligned per line, scales up)
 *
 * Data flow per step:
 *   useHighlightPlan (token slicing: ranges + per-line clone HTML + eraser color)
 *     → measureHighlight (JS: plan char ranges → real DOM pixel rects)
 *     → erasers + clone positioned by rect, 1:1 with the plan lines,
 *       so multi-line selections erase every covered line exactly.
 *
 * Animation model:
 *   - `highlight === null` → nothing rendered; AnimatePresence stays mounted
 *     so the full exit (outro) plays and `onExitComplete` fires afterwards —
 *     the navigator uses that signal to actually change slides.
 *   - highlight A → B: dim stays (animating to B's dim amount), A's eraser +
 *     clone exit while B's enter → a smooth crossfade between steps.
 *   - All durations come from the highlight itself (custom transitions or
 *     defaults), for both intro AND outro.
 */
import { useLayoutEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Highlighter } from "shiki";
import type { Highlight } from "@/types";
import {
  measureHighlight,
  type HighlightMeasurement,
} from "@/lib/highlight-utils";
import { useHighlightPlan } from "@/hooks/useHighlightPlan";

interface HighlightLayerProps {
  /** The slide container element ref (the rounded div with theme bg) */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** The code container ref (the inner div with the code) */
  codeContainerRef: React.RefObject<HTMLDivElement | null>;
  /** The full code string of the current slide */
  code: string;
  /** The highlight to render (null = intro/outro clean state) */
  highlight: Highlight | null;
  /** The Shiki highlighter instance for rendering clone text */
  highlighter: Highlighter | null;
  /** The project theme name */
  theme: string;
  /** The language for syntax highlighting */
  language: string;
  /** Font size in pixels */
  fontSize: number;
  /** Line height multiplier */
  lineHeight: number;
  /** Fired after the whole outro finished (slide may advance now). */
  onExitComplete?: () => void;
}

/** Adjust-clamped fallback for the scale-up amount (percent → factor). */
const DEFAULT_SIZE_UP_AMOUNT = 125;
/** Default intro/outro durations (match backend defaults) */
const DEFAULT_DIM_MS = 500;
const DEFAULT_SIZE_MS = 600;

const EASE_DIM = [0.25, 0.1, 0.25, 1] as const;
const EASE_SCALE = [0.34, 1.56, 0.64, 1] as const;

export function HighlightLayer({
  containerRef,
  codeContainerRef,
  code,
  highlight,
  highlighter,
  theme,
  language,
  fontSize,
  lineHeight,
  onExitComplete,
}: HighlightLayerProps) {
  const [measurement, setMeasurement] = useState<HighlightMeasurement | null>(null);
  const rafRef = useRef(0);
  const roRafRef = useRef(0);
  const settleRef = useRef(0);

  // Rust-side plan: per-line char ranges + clone HTML + eraser color.
  // Null until the plan for THIS highlight id has arrived.
  const plan = useHighlightPlan({ highlight, code, highlighter, theme, language });

  // Measure against live DOM; re-run on layout-relevant changes + settle once.
  // NOTE: on a fresh mount an ancestor host ref can attach AFTER this layout
  // effect (reused-root commit ordering) — so "refs null" must retry across
  // frames instead of giving up, otherwise a layer mounted with a highlight
  // already active (e.g. entering Present mid-step) would never appear.
  useLayoutEffect(() => {
    let disposed = false;
    let retries = 0;
    let ro: ResizeObserver | null = null;

    const measure = () => {
      if (disposed) return;
      const container = containerRef.current;
      const codeRoot = codeContainerRef.current;
      if (!container || !codeRoot) {
        if (retries++ < 12) rafRef.current = requestAnimationFrame(measure);
        return;
      }
      if (!ro) {
        // Coalesce observer callbacks to ≤1 measure per animation frame —
        // panel drags fire the observer continuously and a full DOM-range
        // measure per callback would thrash layout during the resize.
        ro = new ResizeObserver(() => {
          if (disposed || roRafRef.current) return;
          roRafRef.current = requestAnimationFrame(() => {
            roRafRef.current = 0;
            measure();
          });
        });
        ro.observe(container);
        ro.observe(codeRoot);
      }
      if (!plan) {
        setMeasurement(null);
        return;
      }
      setMeasurement(
        measureHighlight(container, codeRoot, plan, fontSize, lineHeight),
      );
    };

    measure();
    settleRef.current = window.setTimeout(measure, 280);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafRef.current);
      cancelAnimationFrame(roRafRef.current);
      roRafRef.current = 0;
      window.clearTimeout(settleRef.current);
      ro?.disconnect();
    };
  }, [containerRef, codeContainerRef, plan, fontSize, lineHeight, theme]);

  const dimDuration =
    (highlight?.useCustomTransition ? highlight.dimTransition : DEFAULT_DIM_MS) /
    1000;
  const sizeDuration =
    (highlight?.useCustomTransition
      ? highlight.sizeUpTransition
      : DEFAULT_SIZE_MS) / 1000;
  const dimAmount = (highlight?.dimAmount ?? 75) / 100;
  const sizeUpAmount = highlight?.sizeUpAmount ?? DEFAULT_SIZE_UP_AMOUNT;
  // 100% = no visual scale (same as size-up off); up to 300% pop.
  const scaleTarget =
    highlight?.sizeUpEnabled && sizeUpAmount > 100
      ? Math.min(Math.max(sizeUpAmount, 100), 300) / 100
      : 1;

  const hasSegments = Boolean(
    plan && measurement && measurement.segments.length > 0,
  );
  const union = measurement?.union;

  // Flat pieces under ONE AnimatePresence so every part (dim, erasers, clone)
  // plays its own exit when the highlight is dismissed. With a nested
  // AnimatePresence the inner exits never ran on unmount — which killed the
  // outro for single/last highlights before a slide change.
  const pieces: React.ReactNode[] = [];
  if (highlight) {
    pieces.push(
      /* Dim overlay — mounted for the whole highlight session (persisting
         across steps AND across the async plan hand-off between them, so the
         dim never flickers out when stepping A → B). */
      <motion.div
        key="hl-dim"
        className="pointer-events-none absolute inset-0 z-20"
        style={{ backgroundColor: "rgba(0, 0, 0, 1)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: dimAmount }}
        exit={{ opacity: 0 }}
        transition={{ duration: dimDuration, ease: EASE_DIM }}
      />,
    );
  }
  if (highlight && hasSegments && plan && union) {
    /* Per-line erasers keyed by step — crossfade between highlights.
       The color is the dimmed card itself (mixed in Rust), so the box is
       invisible; only the original glyphs underneath disappear. */
    measurement.segments.forEach((seg) => {
      pieces.push(
        <motion.div
          key={`${highlight.id}-eraser-${seg.line.lineIndex}`}
          className="pointer-events-none absolute z-20"
          style={{
            left: seg.rect.x,
            top: seg.rect.y,
            width: seg.rect.width,
            height: seg.rect.height,
            backgroundColor: plan.eraserColor,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: dimDuration, ease: EASE_DIM }}
        />,
      );
    });

    pieces.push(
      /* Clone — scales up from the selection center, settles back on outro */
      <motion.div
        key={`${highlight.id}-clone`}
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
      </motion.div>,
    );
  }

  return (
    <AnimatePresence onExitComplete={onExitComplete}>{pieces}</AnimatePresence>
  );
}
