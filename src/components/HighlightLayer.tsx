/**
 * HighlightLayer — renders the highlight effect overlay on top of a slide preview.
 *
 * Layering (bottom to top):
 *   1. ShikiMagicMove code (always rendered underneath)
 *   2. Dim overlay (semi-transparent black covering the slide card)
 *   3. "Eraser" div at the selected text position (matches slide bg color)
 *   4. Clone text (syntax-highlighted, positioned exactly, scales up)
 *
 * This approach ensures:
 *   - No double-text (original is erased, clone is on top)
 *   - No morph animation interference (ShikiMagicMove is untouched)
 *   - Smooth intro/outro transitions via framer-motion
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Highlighter } from "shiki";
import type { Highlight } from "@/types";
import { themeBackground } from "@/types";

interface HighlightLayerProps {
  /** The slide container element ref (the rounded div with theme bg) */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** The code container ref (the inner div with the code) */
  codeContainerRef: React.RefObject<HTMLDivElement | null>;
  /** The full code string of the current slide */
  code: string;
  /** The highlight to render (null = no highlight active) */
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
  /** Whether we are in presenting mode */
  isPresenting: boolean;
  /** Callback when the outro animation completes */
  onOutroComplete?: () => void;
  /** Whether this highlight is currently in its outro phase */
  isOutro: boolean;
  /** Whether this highlight is in its intro/active phase */
  isActive: boolean;
}

/** Default scale-up factor for highlighted text */
const SCALE_FACTOR = 1.25;

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
  isPresenting: _isPresenting,
  onOutroComplete,
  isOutro,
  isActive,
}: HighlightLayerProps) {
  const [charWidth, setCharWidth] = useState<number>(0);
  const [containerRect, setContainerRect] = useState<DOMRect | null>(null);
  const [codeRect, setCodeRect] = useState<DOMRect | null>(null);
  const cloneRef = useRef<HTMLDivElement>(null);

  // Measure character width and container rects
  useEffect(() => {
    if (!containerRef.current || !codeContainerRef.current) return;

    const measure = () => {
      const container = containerRef.current!;
      const codeEl = codeContainerRef.current!;

      // Measure char width using a test span
      const test = document.createElement("span");
      test.style.position = "absolute";
      test.style.visibility = "hidden";
      test.style.whiteSpace = "pre";
      test.style.fontSize = `${fontSize}px`;
      test.style.fontFamily =
        '"JetBrains Mono", "Fira Code", ui-monospace, SFMono-Regular, Menlo, monospace';
      test.style.lineHeight = "1";
      test.style.fontWeight = "500";
      test.style.letterSpacing = "0.025em";
      test.textContent = "xxxxxxxxxx";
      container.appendChild(test);
      const measuredWidth = test.getBoundingClientRect().width / 10;
      container.removeChild(test);

      setCharWidth(measuredWidth);
      setContainerRect(container.getBoundingClientRect());
      setCodeRect(codeEl.getBoundingClientRect());
    };

    measure();

    // Re-measure on resize
    const ro = new ResizeObserver(measure);
    ro.observe(containerRef.current);
    ro.observe(codeContainerRef.current);

    return () => ro.disconnect();
  }, [containerRef, codeContainerRef, fontSize]);

  // Calculate highlight position relative to the container
  const position = useMemo(() => {
    if (!highlight || !containerRect || !codeRect || charWidth === 0) return null;

    const lineH = fontSize * lineHeight;
    const numLines = highlight.endLine - highlight.startLine + 1;

    // Code container offset within the slide container
    const offsetX = codeRect.left - containerRect.left;
    const offsetY = codeRect.top - containerRect.top;

    const x = offsetX + highlight.startChar * charWidth;
    const y = offsetY + highlight.startLine * lineH;
    const height = numLines * lineH;

    // Calculate width for each line in the range
    const codeLines = code.split("\n");
    let maxWidth = 0;
    if (numLines === 1) {
      maxWidth = (highlight.endChar - highlight.startChar) * charWidth;
    } else {
      // First line: from startChar to end of line
      const firstLen = (codeLines[highlight.startLine]?.length ?? 0) - highlight.startChar;
      maxWidth = firstLen * charWidth;
      // Middle lines: full line length
      for (let i = highlight.startLine + 1; i < highlight.endLine; i++) {
        const w = (codeLines[i]?.length ?? 0) * charWidth;
        if (w > maxWidth) maxWidth = w;
      }
      // Last line: from start to endChar
      const lastLen = highlight.endChar;
      if (lastLen * charWidth > maxWidth) maxWidth = lastLen * charWidth;
    }

    return {
      x,
      y,
      width: Math.max(maxWidth, charWidth),
      height,
    };
  }, [highlight, containerRect, codeRect, charWidth, code, fontSize, lineHeight]);

  // Generate the clone HTML using Shiki
  const cloneHtml = useMemo(() => {
    if (!highlight || !highlighter || !code) return "";

    const canUseShiki = highlighter.getLoadedLanguages().includes(language);
    if (!canUseShiki) return "";

    try {
      // Render the full code and extract the relevant lines
      const html = highlighter.codeToHtml(code, { lang: language, theme });
      // Parse the rendered HTML to extract lines in the highlight range
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const codeEl = doc.querySelector("code");
      if (!codeEl) return "";

      // Shiki renders lines separated by newlines within span.line elements
      const lineSpans = codeEl.querySelectorAll(".line");
      const selectedLines: string[] = [];

      for (let i = highlight.startLine; i <= highlight.endLine; i++) {
        const lineEl = lineSpans[i];
        if (!lineEl) continue;

        const lineInner = lineEl.innerHTML;
        if (i === highlight.startLine && i === highlight.endLine) {
          // Single line: extract char range
          selectedLines.push(
            extractVisibleChars(lineInner, highlight.startChar, highlight.endChar),
          );
        } else if (i === highlight.startLine) {
          selectedLines.push(
            extractVisibleChars(lineInner, highlight.startChar, -1),
          );
        } else if (i === highlight.endLine) {
          selectedLines.push(
            extractVisibleChars(lineInner, 0, highlight.endChar),
          );
        } else {
          selectedLines.push(lineInner);
        }
      }

      return selectedLines.join("\n");
    } catch {
      return "";
    }
  }, [highlight, highlighter, code, language, theme]);

  // Animation durations
  const dimDuration = highlight?.useCustomTransition
    ? highlight.dimTransition
    : 500;
  const sizeUpDuration = highlight?.useCustomTransition
    ? highlight.sizeUpTransition
    : 600;
  const dimAmount = (highlight?.dimAmount ?? 75) / 100;
  const bg = themeBackground(theme);

  // Scale factor applied to the clone text
  const scaleTarget = highlight?.sizeUpEnabled ? SCALE_FACTOR : 1;

  const show = isActive && !isOutro && highlight && position;
  const showOutro = isOutro && highlight && position;

  return (
    <AnimatePresence onExitComplete={onOutroComplete}>
      {(show || showOutro) && position && (
        <motion.div
          key="highlight-layer"
          className="pointer-events-none absolute inset-0 z-20 overflow-hidden"
          style={{ borderRadius: "inherit" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: showOutro ? dimDuration / 1000 : 0.1 }}
        >
          {/* Dim overlay — covers entire slide card */}
          <motion.div
            className="absolute inset-0"
            style={{ backgroundColor: "rgba(0, 0, 0, 1)" }}
            initial={{ opacity: 0 }}
            animate={{
              opacity: show ? dimAmount : 0,
            }}
            exit={{ opacity: 0 }}
            transition={{
              duration: (show ? dimDuration : dimDuration) / 1000,
              ease: [0.25, 0.1, 0.25, 1],
            }}
          />

          {/* Eraser div — covers original text position with slide bg color */}
          <motion.div
            className="absolute"
            style={{
              left: position.x,
              top: position.y,
              width: position.width,
              height: position.height,
              backgroundColor: bg,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: show ? 1 : 0 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: (show ? dimDuration : dimDuration) / 1000,
              ease: [0.25, 0.1, 0.25, 1],
            }}
          />

          {/* Clone text — positioned exactly, scales up from center */}
          <motion.div
            ref={cloneRef}
            className="absolute font-mono font-medium tracking-wide"
            style={{
              left: position.x,
              top: position.y,
              width: position.width,
              height: position.height,
              fontSize: `${fontSize}px`,
              lineHeight: lineHeight.toString(),
              whiteSpace: "pre",
              transformOrigin: "center center",
              willChange: "transform",
            }}
            initial={{ scale: 1, opacity: 0 }}
            animate={{
              scale: show ? scaleTarget : 1,
              opacity: show ? 1 : 0,
            }}
            exit={{ scale: 1, opacity: 0 }}
            transition={{
              scale: {
                duration: (show ? sizeUpDuration : sizeUpDuration) / 1000,
                ease: [0.34, 1.56, 0.64, 1],
              },
              opacity: {
                duration: (show ? dimDuration : dimDuration) / 1000,
                ease: "easeInOut",
              },
            }}
          >
            <pre
              style={{
                margin: 0,
                padding: 0,
                background: "transparent",
                whiteSpace: "pre",
                fontFamily: "inherit",
                fontSize: "inherit",
                lineHeight: "inherit",
              }}
              dangerouslySetInnerHTML={{ __html: cloneHtml }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Extract visible characters from an HTML string while preserving tags.
 * Counts only text nodes (not HTML markup).
 */
function extractVisibleChars(html: string, start: number, end: number): string {
  let charIndex = 0;
  let inTag = false;
  let result = "";
  let openTags: string[] = [];

  for (let i = 0; i < html.length; i++) {
    const ch = html[i];

    if (ch === "<") {
      inTag = true;
      // Check if this is an opening or closing tag
      const tagEnd = html.indexOf(">", i);
      if (tagEnd !== -1) {
        const tagContent = html.slice(i + 1, tagEnd);
        if (tagContent.startsWith("/")) {
          // Closing tag
          if (charIndex >= start && (end === -1 || charIndex < end)) {
            result += html.slice(i, tagEnd + 1);
          }
          openTags.pop();
        } else if (!tagContent.endsWith("/")) {
          // Opening tag (not self-closing)
          if (charIndex >= start && (end === -1 || charIndex < end)) {
            result += html.slice(i, tagEnd + 1);
            const tagName = tagContent.split(/\s/)[0];
            openTags.push(tagName);
          } else {
            openTags.push(tagContent.split(/\s/)[0]);
          }
        } else {
          // Self-closing tag
          if (charIndex >= start && (end === -1 || charIndex < end)) {
            result += html.slice(i, tagEnd + 1);
          }
        }
        i = tagEnd;
      }
      inTag = false;
      continue;
    }

    if (inTag) continue;

    // Visible character
    if (charIndex >= start && (end === -1 || charIndex < end)) {
      result += ch;
    }
    charIndex++;
  }

  return result;
}
