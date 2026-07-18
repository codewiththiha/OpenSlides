/**
 * Utility functions for highlight mode.
 * Handles text position calculation, range extraction, and DOM measurement.
 */
import type { Highlight } from "@/types";

/** A single measured line box of a highlight, relative to the slide container. */
export interface HighlightLineRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Measured geometry for a highlight: one rect per line + union box. */
export interface HighlightMeasurement {
  lines: HighlightLineRect[];
  union: HighlightLineRect;
}

/** Generate a simple unique ID for highlights */
export function generateHighlightId(): string {
  return `hl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Default values for a new highlight */
export function createDefaultHighlight(
  startLine: number,
  startChar: number,
  endLine: number,
  endChar: number,
): Highlight {
  return {
    id: generateHighlightId(),
    startLine,
    startChar,
    endLine,
    endChar,
    dimAmount: 75,
    sizeUpEnabled: true,
    useCustomTransition: false,
    dimTransition: 500,
    sizeUpTransition: 600,
  };
}

/**
 * Extract the selected text from code given a highlight range.
 * Works with the raw code string.
 */
export function extractHighlightText(
  code: string,
  highlight: Highlight,
): string {
  const lines = code.split("\n");
  if (highlight.startLine === highlight.endLine) {
    const line = lines[highlight.startLine] ?? "";
    return line.slice(highlight.startChar, highlight.endChar);
  }
  const result: string[] = [];
  for (let i = highlight.startLine; i <= highlight.endLine; i++) {
    const line = lines[i] ?? "";
    if (i === highlight.startLine) {
      result.push(line.slice(highlight.startChar));
    } else if (i === highlight.endLine) {
      result.push(line.slice(0, highlight.endChar));
    } else {
      result.push(line);
    }
  }
  return result.join("\n");
}

/**
 * Extract the lines of code that contain the highlight.
 * Returns the full lines (not truncated).
 */
export function extractHighlightLines(
  code: string,
  highlight: Highlight,
): string[] {
  const lines = code.split("\n");
  return lines.slice(highlight.startLine, highlight.endLine + 1);
}

/**
 * Calculate the pixel position of a highlight range within a monospace code block.
 * Uses character width and line height for precise positioning.
 */
export function calculateHighlightPosition(
  container: HTMLElement,
  highlight: Highlight,
  charWidth: number,
  lineHeight: number,
  paddingTop: number,
  paddingLeft: number,
): { x: number; y: number; width: number; height: number } {
  const numLines = highlight.endLine - highlight.startLine + 1;

  // Calculate width: for single line, it's (endChar - startChar) * charWidth
  // For multi-line, it's the max width of any line in the range
  let maxWidth: number;
  if (numLines === 1) {
    maxWidth = (highlight.endChar - highlight.startChar) * charWidth;
  } else {
    // Multi-line: width is from startChar to end of first line, then full lines, then to endChar
    // We use the max of the first line's remainder and last line's end
    const codeLines = container.closest("[data-code-container]")?.getAttribute("data-code")?.split("\n") ?? [];
    const firstLineWidth = ((codeLines[highlight.startLine]?.length ?? 0) - highlight.startChar) * charWidth;
    const lastLineWidth = highlight.endChar * charWidth;
    maxWidth = Math.max(firstLineWidth, lastLineWidth);
    // Also consider middle lines
    for (let i = highlight.startLine + 1; i < highlight.endLine; i++) {
      const w = (codeLines[i]?.length ?? 0) * charWidth;
      if (w > maxWidth) maxWidth = w;
    }
  }

  const x = paddingLeft + highlight.startChar * charWidth;
  const y = paddingTop + highlight.startLine * lineHeight;
  const height = numLines * lineHeight;

  return { x, y, width: Math.max(maxWidth, charWidth), height };
}

/**
 * Get the center point of a highlight's bounding area.
 * Used as transform-origin for scale-up animation.
 */
export function getHighlightCenter(
  pos: { x: number; y: number; width: number; height: number },
): { cx: number; cy: number } {
  return {
    cx: pos.x + pos.width / 2,
    cy: pos.y + pos.height / 2,
  };
}

/**
 * Measure character width in a given container by creating a test element.
 */
export function measureCharWidth(
  container: HTMLElement,
  fontSize: number,
  fontFamily: string,
): number {
  const test = document.createElement("span");
  test.style.position = "absolute";
  test.style.visibility = "hidden";
  test.style.whiteSpace = "pre";
  test.style.fontSize = `${fontSize}px`;
  test.style.fontFamily = fontFamily;
  test.style.lineHeight = "1";
  test.textContent = "xxxxxxxxxx"; // 10 x's for accuracy
  container.appendChild(test);
  const width = test.getBoundingClientRect().width / 10;
  container.removeChild(test);
  return width;
}

/**
 * Build an HTML string for the highlighted text range with proper syntax colors.
 * This takes the full Shiki-rendered HTML and extracts just the highlight range.
 */
export function extractHighlightedHtml(
  fullHtml: string,
  highlight: Highlight,
): string {
  // Parse the HTML to find line spans
  const parser = new DOMParser();
  const doc = parser.parseFromString(
    `<div>${fullHtml}</div>`,
    "text/html",
  );
  const root = doc.body.firstElementChild;
  if (!root) return "";

  // Find all line elements - shiki renders each line as a span
  // ShikiMagicMove uses individual character spans, but regular Shiki uses line spans
  const lines = root.querySelectorAll(".line, [data-line]");

  if (lines.length === 0) {
    // Fallback: treat the entire HTML as a single block
    // Split by newlines
    const allLines = fullHtml.split("\n");
    const selected = allLines.slice(
      highlight.startLine,
      highlight.endLine + 1,
    );
    return selected.join("\n");
  }

  const result: string[] = [];
  for (let i = highlight.startLine; i <= highlight.endLine; i++) {
    const lineEl = lines[i];
    if (!lineEl) continue;

    const lineHtml = lineEl.innerHTML;
    if (i === highlight.startLine && i === highlight.endLine) {
      // Single line: extract character range
      result.push(extractCharRange(lineHtml, highlight.startChar, highlight.endChar));
    } else if (i === highlight.startLine) {
      result.push(extractCharRange(lineHtml, highlight.startChar, -1));
    } else if (i === highlight.endLine) {
      result.push(extractCharRange(lineHtml, 0, highlight.endChar));
    } else {
      result.push(lineHtml);
    }
  }

  return result.join("\n");
}

/**
 * Extract a character range from an HTML string while preserving tags.
 * Counts only visible characters (not HTML tags).
 */
function extractCharRange(html: string, start: number, end: number): string {  let charIndex = 0;
  let inTag = false;
  let result = "";
  let capturing = false;

  for (let i = 0; i < html.length; i++) {
    const ch = html[i];

    if (ch === "<") {
      inTag = true;
      if (capturing) result += ch;
      continue;
    }
    if (ch === ">") {
      inTag = false;
      if (capturing) result += ch;
      continue;
    }
    if (inTag) {
      if (capturing) result += ch;
      continue;
    }

    // Visible character
    if (charIndex >= start && (end === -1 || charIndex < end)) {
      if (!capturing) {
        // Start capturing: include any open tags we need
        capturing = true;
      }
      result += ch;
    }

    charIndex++;

    if (end !== -1 && charIndex >= end && !inTag) {
      break;
    }
  }

  return result;
}

/* ----------------------------------------------------------------------- *
 * DOM-measured highlight geometry
 *
 * The slide code is rendered by shiki-magic-move as token <span>s with
 * <br> line separators (optionally preceded by .shiki-magic-move-line-number
 * spans), or by the merustmar fallback as <span class="line">…</span> joined
 * by "\n" text nodes. Character-count × char-width math cannot account for
 * the line-number gutter, center alignment or proportional renderer quirks,
 * so we measure real DOM ranges instead. A char-width fallback is kept for
 * unmeasurable edge cases.
 * ----------------------------------------------------------------------- */

/** Collect visible text nodes per code line, in document order. */
function collectLineTextNodes(root: HTMLElement): Text[][] {
  const lines: Text[][] = [];

  // Shape A: explicit line spans (merustmar fallback / plain shiki html).
  const lineSpans = root.querySelectorAll("span.line");
  if (lineSpans.length > 0) {
    lineSpans.forEach((span) => {
      const nodes: Text[] = [];
      const walker = document.createTreeWalker(span, NodeFilter.SHOW_TEXT);
      let n = walker.nextNode();
      while (n) {
        if ((n as Text).data) nodes.push(n as Text);
        n = walker.nextNode();
      }
      lines.push(nodes);
    });
    return lines;
  }

  // Shape B: token spans separated by <br> (shiki-magic-move renderer).
  const current: Text[][] = [[]];
  const walk = (node: Node) => {
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as HTMLElement;
        if (el.tagName === "BR") {
          current.push([]);
          return;
        }
        if (el.classList.contains("shiki-magic-move-line-number")) return;
        walk(el);
        return;
      }
      if (child.nodeType === Node.TEXT_NODE) {
        const t = child as Text;
        if (t.data === "\n") {
          current.push([]);
        } else if (t.data) {
          current[current.length - 1].push(t);
        }
      }
    });
  };
  walk(root);
  // Drop a trailing empty line produced by a final <br>.
  while (current.length > 1 && current[current.length - 1].length === 0) {
    current.pop();
  }
  return current;
}

/**
 * Bounding rect (viewport coords) of a character range across a line's text
 * nodes. end = -1 means "to end of line".
 */
function rectForCharRange(
  nodes: Text[],
  start: number,
  end: number,
): DOMRect | null {
  if (nodes.length === 0) return null;
  const range = document.createRange();
  let acc = 0;
  let started = false;
  for (const tn of nodes) {
    const len = tn.data.length;
    const next = acc + len;
    if (!started && start <= next) {
      range.setStart(tn, Math.min(len, Math.max(0, start - acc)));
      started = true;
    }
    if (started && (end === -1 || end <= next)) {
      const stop = end === -1 ? len : Math.min(len, Math.max(0, end - acc));
      range.setEnd(tn, stop);
      return range.getBoundingClientRect();
    }
    acc = next;
  }
  if (!started) return null;
  const last = nodes[nodes.length - 1];
  range.setEnd(last, last.data.length);
  return range.getBoundingClientRect();
}

/**
 * Measure a highlight against the live DOM.
 * `container` is the slide card the overlay is absolutely positioned in;
 * `codeRoot` wraps the rendered code (magic-move container or merustmar pre).
 */
export function measureHighlight(
  container: HTMLElement,
  codeRoot: HTMLElement,
  highlight: Highlight,
  code: string,
  fontSize: number,
  lineHeight: number,
): HighlightMeasurement | null {
  const cRect = container.getBoundingClientRect();
  const codeLines = code.split("\n");
  const lineNodes = collectLineTextNodes(codeRoot);

  const usable =
    lineNodes.length > highlight.startLine &&
    (lineNodes[highlight.startLine]?.length ?? 0) > 0;

  const lines: HighlightLineRect[] = [];

  if (usable) {
    for (let i = highlight.startLine; i <= highlight.endLine; i++) {
      const nodes = lineNodes[i];
      if (!nodes || nodes.length === 0) continue;
      const start = i === highlight.startLine ? highlight.startChar : 0;
      const end = i === highlight.endLine ? highlight.endChar : -1;
      const r = rectForCharRange(nodes, start, end);
      if (!r || (r.width === 0 && r.height === 0)) continue;
      lines.push({
        x: r.left - cRect.left,
        y: r.top - cRect.top,
        width: Math.max(r.width, 1),
        height: Math.max(r.height, 1),
      });
    }
  }

  // Fallback: monospace math (kept for mid-animation/unmeasurable states).
  if (lines.length === 0) {
    const cws = measureCharWidth(
      codeRoot,
      fontSize,
      getComputedStyle(codeRoot).fontFamily ||
        'ui-monospace, SFMono-Regular, Menlo, monospace',
    );
    if (!cws || !Number.isFinite(cws)) return null;
    const kRect = codeRoot.getBoundingClientRect();
    const ox = kRect.left - cRect.left;
    const oy = kRect.top - cRect.top;
    const lh = fontSize * lineHeight;
    for (let i = highlight.startLine; i <= highlight.endLine; i++) {
      const text = codeLines[i] ?? "";
      const start = i === highlight.startLine ? highlight.startChar : 0;
      const end = i === highlight.endLine ? highlight.endChar : text.length;
      lines.push({
        x: ox + start * cws,
        y: oy + i * lh,
        width: Math.max((end - start) * cws, cws),
        height: lh,
      });
    }
  }

  if (lines.length === 0) return null;

  const union = lines.reduce(
    (acc, r) => ({
      x: Math.min(acc.x, r.x),
      y: Math.min(acc.y, r.y),
      right: Math.max(acc.right, r.x + r.width),
      bottom: Math.max(acc.bottom, r.y + r.height),
    }),
    {
      x: lines[0].x,
      y: lines[0].y,
      right: lines[0].x + lines[0].width,
      bottom: lines[0].y + lines[0].height,
    },
  );

  return {
    lines,
    union: {
      x: union.x,
      y: union.y,
      width: Math.max(union.right - union.x, 1),
      height: Math.max(union.bottom - union.y, 1),
    },
  };
}

/**
 * Extract visible characters [start, end) from an HTML line while keeping
 * any intersecting tags balanced. end = -1 takes the rest of the line.
 */
export function extractVisibleChars(
  html: string,
  start: number,
  end: number,
): string {
  let charIndex = 0;
  let result = "";
  const inRange = () => charIndex >= start && (end === -1 || charIndex < end);

  for (let i = 0; i < html.length; i++) {
    const ch = html[i];
    if (ch === "<") {
      const tagEnd = html.indexOf(">", i);
      if (tagEnd === -1) break;
      if (inRange()) result += html.slice(i, tagEnd + 1);
      i = tagEnd;
      continue;
    }
    if (inRange()) result += ch;
    charIndex++;
  }
  return result;
}
