/**
 * highlight-utils — everything about mapping a Highlight range onto text
 * and onto the rendered slide DOM.
 *
 * Layout:
 *   1. ID/defaults
 *   2. Line-range parsing (pure) — highlightLineRanges() is THE single
 *      source of truth for "which lines, which char→char per line".
 *      Everything else (text extraction, clone html, DOM measurement)
 *      is derived from it, so the rules can't drift apart.
 *   3. Text / html extraction (pure)
 *   4. DOM geometry — real Range measurement with a monospace fallback
 *   5. Color helpers
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

/** One parsed highlight line: the [start, end) character span to cover. */
export interface HighlightLineRange {
  /** Absolute line index in the code. */
  line: number;
  /** Inclusive start char. */
  start: number;
  /** Exclusive end char. */
  end: number;
}

/* ----------------------------------------------------------------------- *
 * 1. ID / defaults
 * ----------------------------------------------------------------------- */

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
    sizeUpAmount: 125,
    useCustomTransition: false,
    dimTransition: 500,
    sizeUpTransition: 600,
  };
}

/* ----------------------------------------------------------------------- *
 * 2. Line-range parsing
 * ----------------------------------------------------------------------- */

/**
 * Resolve a Highlight into concrete per-line character spans.
 *
 * Rules (single definition used by erase rects, clone slices and text
 * extraction alike):
 *   - only line  → [startChar, endChar)
 *   - first line → [startChar, end-of-line)
 *   - middle     → whole line
 *   - last line  → [0, endChar)
 *
 * Handles reversed selections defensively and clamps to the real code.
 */
export function highlightLineRanges(
  highlight: Highlight,
  code: string,
): HighlightLineRange[] {
  const codeLines = code.split("\n");

  let startLine = Math.max(0, highlight.startLine);
  let startChar = Math.max(0, highlight.startChar);
  let endLine = Math.max(0, highlight.endLine);
  let endChar = Math.max(0, highlight.endChar);

  // Reversed selection (bottom-to-top mouse drag) — normalize.
  if (
    endLine < startLine ||
    (endLine === startLine && endChar < startChar)
  ) {
    [startLine, endLine] = [endLine, startLine];
    [startChar, endChar] = [endChar, startChar];
  }

  const out: HighlightLineRange[] = [];
  for (let line = startLine; line <= endLine; line++) {
    if (line >= codeLines.length) break;
    const len = codeLines[line].length;

    let start = 0;
    let end = len; // exclusive
    if (line === startLine && line === endLine) {
      start = Math.min(startChar, len);
      end = Math.min(endChar, len);
    } else if (line === startLine) {
      start = Math.min(startChar, len);
    } else if (line === endLine) {
      end = Math.min(endChar, len);
    }

    // Empty span on a non-empty line (e.g. caret at EOL) is pointless.
    if (start === end && len > 0) continue;
    out.push({ line, start, end });
  }
  return out;
}

/* ----------------------------------------------------------------------- *
 * 3. Text / html extraction
 * ----------------------------------------------------------------------- */

/** Extract the selected plain text covered by a highlight range. */
export function extractHighlightText(
  code: string,
  highlight: Highlight,
): string {
  const codeLines = code.split("\n");
  return highlightLineRanges(highlight, code)
    .map((r) => codeLines[r.line].slice(r.start, r.end))
    .join("\n");
}

/**
 * Extract the per-line syntax-highlighted slices for the clone from a
 * fully rendered html (shiki `codeToHtml` output or the merustmar
 * fallback — both use `span.line` rows). Falls back to escaped plain
 * text per line when a slice can't be recovered.
 */
export function buildCloneLineHtmls(
  code: string,
  highlight: Highlight,
  fullHtml: string,
): string[] {
  const ranges = highlightLineRanges(highlight, code);
  if (ranges.length === 0) return [];

  let lineSpans: NodeListOf<Element> | [] = [] as unknown as NodeListOf<Element>;
  if (fullHtml) {
    const doc = new DOMParser().parseFromString(fullHtml, "text/html");
    lineSpans = doc.querySelectorAll("code .line, pre .line");
  }

  const codeLines = code.split("\n");
  return ranges.map((r) => {
    const el = lineSpans[r.line];
    let slice = el ? extractVisibleChars(el.innerHTML, r.start, r.end) : "";
    if (!slice.trim()) {
      slice = escapeHtml(codeLines[r.line].slice(r.start, r.end));
    }
    return slice;
  });
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
  const stop = end === -1 ? Number.MAX_SAFE_INTEGER : end;
  const inRange = () => charIndex >= start && charIndex < stop;

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
    if (charIndex >= stop) break;
  }
  return result;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/* ----------------------------------------------------------------------- *
 * 4. DOM geometry
 *
 * The slide code is rendered by shiki-magic-move as token <span>s with
 * <br> line separators (optionally preceded by line-number spans), or by
 * the merustmar fallback as <span class="line">…</span> rows. char-count ×
 * char-width math can't account for the line-number gutter or center
 * alignment, so we measure real DOM ranges and keep a monospace fallback
 * for unmeasurable states (mid-morph, hidden, …).
 * ----------------------------------------------------------------------- */

/**
 * Collect visible text nodes per code line, in document order.
 * Style/script subtrees are skipped — SlidePreview mounts an inline
 * <style> inside the code container, whose text must NOT become "line 0".
 */
function collectLineTextNodes(root: HTMLElement): Text[][] {
  // Shape A: explicit line spans (merustmar fallback / plain shiki html).
  const lineSpans = root.querySelectorAll(
    ":is(pre, code) span.line, span.line",
  );
  if (lineSpans.length > 0) {
    return Array.from(lineSpans, (span) => {
      const nodes: Text[] = [];
      const walker = document.createTreeWalker(span, NodeFilter.SHOW_TEXT);
      let n = walker.nextNode();
      while (n) {
        if ((n as Text).data) nodes.push(n as Text);
        n = walker.nextNode();
      }
      return nodes;
    });
  }

  // Shape B: token spans separated by <br> (shiki-magic-move renderer).
  const lines: Text[][] = [[]];
  const walk = (node: Node) => {
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as HTMLElement;
        if (el.tagName === "BR") {
          lines.push([]);
          return;
        }
        if (
          el.tagName === "STYLE" ||
          el.tagName === "SCRIPT" ||
          el.classList.contains("shiki-magic-move-line-number")
        ) {
          return;
        }
        walk(el);
        return;
      }
      if (child.nodeType === Node.TEXT_NODE) {
        const t = child as Text;
        if (t.data === "\n") {
          lines.push([]);
        } else if (t.data) {
          lines[lines.length - 1].push(t);
        }
      }
    });
  };
  walk(root);
  // Drop trailing empty lines produced by a final <br>.
  while (lines.length > 1 && lines[lines.length - 1].length === 0) {
    lines.pop();
  }
  return lines;
}

/**
 * Bounding rect (viewport coords) of a character span across a line's text
 * nodes. Both ends are resolved explicitly; spans reaching the end of the
 * line resolve against the LAST node (a single early return at the first
 * node was the multi-line erase bug).
 */
function rectForCharSpan(
  nodes: Text[],
  start: number,
  end: number,
): DOMRect | null {
  if (nodes.length === 0 || start >= end) return null;

  let startNode: Text | null = null;
  let endNode: Text | null = null;
  let startOffset = 0;
  let endOffset = 0;
  let acc = 0;

  for (const tn of nodes) {
    const len = tn.data.length;
    const next = acc + len;
    if (startNode === null && start <= next) {
      startNode = tn;
      startOffset = Math.min(len, Math.max(0, start - acc));
    }
    if (endNode === null && end <= next) {
      endNode = tn;
      endOffset = Math.min(len, Math.max(0, end - acc));
    }
    if (startNode !== null && endNode !== null) break;
    acc = next;
  }
  if (startNode === null) return null;
  if (endNode === null) {
    endNode = nodes[nodes.length - 1];
    endOffset = endNode.data.length;
  }

  const range = document.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  return range.getBoundingClientRect();
}

/**
 * Measure character width in a given container by creating a test element.
 * (Only used by the monospace-fallback path.)
 */
function measureCharWidth(
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
  const ranges = highlightLineRanges(highlight, code);
  const lineNodes = collectLineTextNodes(codeRoot);
  const lines: HighlightLineRect[] = [];

  const domUsable =
    lineNodes.length > highlight.startLine &&
    ranges.some((r) => (lineNodes[r.line]?.length ?? 0) > 0);

  if (domUsable) {
    for (const r of ranges) {
      const nodes = lineNodes[r.line];
      if (!nodes || nodes.length === 0) continue; // empty code line
      // At least one node must actually cover part of the requested span,
      // otherwise a stale/short DOM (mid-morph) would misplace the rect.
      const totalChars = nodes.reduce((n, t) => n + t.data.length, 0);
      if (r.start >= totalChars) continue;
      const rect = rectForCharSpan(nodes, r.start, r.end);
      if (!rect || rect.width === 0 || rect.height === 0) continue;
      lines.push({
        x: rect.left - cRect.left,
        y: rect.top - cRect.top,
        width: Math.max(rect.width, 1),
        height: Math.max(rect.height, 1),
      });
    }
  }

  // Fallback: monospace math (kept for mid-animation/unmeasurable states).
  if (lines.length === 0) {
    const cws = measureCharWidth(
      codeRoot,
      fontSize,
      getComputedStyle(codeRoot).fontFamily ||
        "ui-monospace, SFMono-Regular, Menlo, monospace",
    );
    if (!cws || !Number.isFinite(cws)) return null;
    const kRect = codeRoot.getBoundingClientRect();
    const ox = kRect.left - cRect.left;
    const oy = kRect.top - cRect.top;
    const lh = fontSize * lineHeight;
    for (const r of ranges) {
      lines.push({
        x: ox + r.start * cws,
        y: oy + r.line * lh,
        width: Math.max((r.end - r.start) * cws, cws),
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

/* ----------------------------------------------------------------------- *
 * 5. Color helpers
 * ----------------------------------------------------------------------- */

/**
 * Mix a #rrggbb color toward black by t (0 = unchanged, 1 = black).
 * Used for eraser boxes so they match the dimmed card exactly
 * (bg + the same black overlay), avoiding a visible rectangle.
 */
export function mixTowardBlack(hex: string, t: number): string {
  const m = hex.replace("#", "");
  if (m.length !== 6) return hex;
  const k = 1 - Math.min(Math.max(t, 0), 1);
  const mix = (part: string) => Math.round(parseInt(part, 16) * k);
  return `rgb(${mix(m.slice(0, 2))}, ${mix(m.slice(2, 4))}, ${mix(m.slice(4, 6))})`;
}
