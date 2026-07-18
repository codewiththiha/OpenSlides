/**
 * HighlightLayer — renders the highlight effect overlay on a slide preview.
 *
 * Layering (bottom to top):
 *   1. shiki-magic-move code (always rendered underneath, untouched)
 *   2. Dim overlay covering the whole slide card (persists across steps)
 *   3. Per-line "eraser" boxes over the selected text (slide bg color)
 *   4. Clone text (syntax-highlighted, pixel-aligned per line, scales up)
 *
 * Animation model:
 *   - `highlight === null` → nothing rendered; AnimatePresence stays mounted
 *     so the full exit (outro) plays and `onExitComplete` fires afterwards —
 *     the navigator uses that signal to actually change slides.
 *   - highlight A → B: dim stays (animating to B's dim amount), A's eraser +
 *     clone exit while B's enter → a smooth crossfade between steps.
 *   - All durations come from the highlight itself (custom transitions or
 *     defaults), for both intro AND outro.
 *
 * Geometry is measured from real DOM ranges (see lib/highlight-utils), so it
 * stays exact with line numbers, block centering and any font metrics.
 */
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Highlighter } from "shiki";
import type { Highlight } from "@/types";
import { themeBackground, LIGHT_THEMES } from "@/types";
import {
  extractVisibleChars,
  measureHighlight,
  type HighlightMeasurement,
} from "@/lib/highlight-utils";
import { highlightMerustmarCode } from "@/lib/merustmar-highlight";

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

/** Default scale-up factor for highlighted text */
const SCALE_FACTOR = 1.25;
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
  const settleRef = useRef(0);

  // Measure against live DOM; re-run on layout-relevant changes + settle once.
  useLayoutEffect(() => {
    const container = containerRef.current;
    const codeRoot = codeContainerRef.current;
    if (!container || !codeRoot) {
      setMeasurement(null);
      return;
    }

    const measure = () => {
      if (!highlight) {
        setMeasurement(null);
        return;
      }
      setMeasurement(
        measureHighlight(
          container,
          codeRoot,
          highlight,
          code,
          fontSize,
          lineHeight,
        ),
      );
    };

    measure();
    rafRef.current = requestAnimationFrame(measure);
    settleRef.current = window.setTimeout(measure, 280);

    const ro = new ResizeObserver(measure);
    ro.observe(container);
    ro.observe(codeRoot);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.clearTimeout(settleRef.current);
      ro.disconnect();
    };
  }, [containerRef, codeContainerRef, highlight, code, fontSize, lineHeight, theme]);

  // Per-line selected HTML for the clone, pulled from the rendered syntax
  // html (shiki, or the merustmar fallback) so colors match the slide code.
  const cloneLineHtmls = useMemo(() => {
    if (!highlight || !code) return [] as string[];

    let html = "";
    if (highlighter && highlighter.getLoadedLanguages().includes(language)) {
      try {
        html = highlighter.codeToHtml(code, { lang: language, theme });
      } catch {
        html = "";
      }
    }
    if (!html && language === "merustmar") {
      html = highlightMerustmarCode(code, !LIGHT_THEMES.has(theme));
    }
    if (!html) return [];

    const doc = new DOMParser().parseFromString(html, "text/html");
    const lineSpans = doc.querySelectorAll("code .line, pre .line");
    if (lineSpans.length === 0) return [];

    const plain = code.split("\n");
    const out: string[] = [];
    for (let i = highlight.startLine; i <= highlight.endLine; i++) {
      const el = lineSpans[i];
      const s = i === highlight.startLine ? highlight.startChar : 0;
      const e = i === highlight.endLine ? highlight.endChar : -1;
      let slice = el ? extractVisibleChars(el.innerHTML, s, e) : "";
      if (!slice.trim() && plain[i] !== undefined) {
        const raw = e === -1 ? plain[i].slice(s) : plain[i].slice(s, e);
        slice = raw
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
      }
      out.push(slice);
    }
    return out;
  }, [highlight, highlighter, code, language, theme]);

  const dimDuration =
    (highlight?.useCustomTransition ? highlight.dimTransition : DEFAULT_DIM_MS) /
    1000;
  const sizeDuration =
    (highlight?.useCustomTransition
      ? highlight.sizeUpTransition
      : DEFAULT_SIZE_MS) / 1000;
  const dimAmount = (highlight?.dimAmount ?? 75) / 100;
  const scaleTarget = highlight?.sizeUpEnabled ? SCALE_FACTOR : 1;
  const bg = themeBackground(theme);

  const active = highlight && measurement && measurement.lines.length > 0;
  const union = measurement?.union;

  return (
    <AnimatePresence onExitComplete={onExitComplete}>
      {active && union && (
        <motion.div
          key="highlight-layer"
          className="pointer-events-none absolute inset-0 z-20 overflow-hidden"
          style={{ borderRadius: "inherit" }}
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 1 }}
        >
          {/* Dim overlay — persists across highlight steps within this slide */}
          <motion.div
            key="hl-dim"
            className="absolute inset-0"
            style={{ backgroundColor: "rgba(0, 0, 0, 1)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: dimAmount }}
            exit={{ opacity: 0 }}
            transition={{ duration: dimDuration, ease: EASE_DIM }}
          />

          {/* Step-scoped pieces: erasers + clone crossfade between highlights */}
          <AnimatePresence>
            {measurement.lines.map((rect, i) => (
              <motion.div
                key={`${highlight.id}-eraser-${i}`}
                className="absolute"
                style={{
                  left: rect.x,
                  top: rect.y,
                  width: rect.width,
                  height: rect.height,
                  backgroundColor: bg,
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: dimDuration, ease: EASE_DIM }}
              />
            ))}

            <motion.div
              key={`${highlight.id}-clone`}
              className="absolute font-mono font-medium tracking-wide"
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
              {measurement.lines.map((rect, i) => (
                <pre
                  key={i}
                  className="absolute whitespace-pre"
                  style={{
                    left: rect.x - union.x,
                    top: rect.y - union.y,
                    margin: 0,
                    padding: 0,
                    background: "transparent",
                    fontFamily: "inherit",
                    fontSize: "inherit",
                    lineHeight: "inherit",
                    letterSpacing: "inherit",
                  }}
                  dangerouslySetInnerHTML={{
                    __html: cloneLineHtmls[i] ?? "",
                  }}
                />
              ))}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
