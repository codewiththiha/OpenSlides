/**
 * Highlight-mode geometry utilities.
 *
 * Pure range/HTML parsing (which lines, which char-from/char-to per line,
 * slice extraction, eraser color) lives in Rust — see
 * `highlight-tokens.ts` (selection slicing over structured tokens). This module
 * keeps only what must happen inside the webview: turning the plan's char
 * ranges into pixel rects by measuring the live DOM.
 */
import type { Highlight } from "@/types";
import type { HighlightPlan, HighlightPlanLine } from "@/lib/highlight-tokens";

/** A single measured line box of a highlight, relative to the slide container. */
export interface HighlightLineRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A measured plan line: the rect plus the line data it belongs to. */
export interface MeasuredSegment {
  line: HighlightPlanLine;
  rect: HighlightLineRect;
}

/** Measured geometry for a highlight: one segment per covered line + union. */
export interface HighlightMeasurement {
  segments: MeasuredSegment[];
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
    sizeUpAmount: 125,
    useCustomTransition: false,
    dimTransition: 500,
    sizeUpTransition: 600,
  };
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
        // <style>/<script> subtrees must never become code "lines", and
        // magic-move line numbers / ghost-fading previous-code tokens
        // (absolutely positioned at stale coordinates) must not corrupt
        // measurements either.
        if (el.tagName === "STYLE" || el.tagName === "SCRIPT") return;
        if (el.classList.contains("shiki-magic-move-line-number")) return;
        if (el.classList.contains("shiki-magic-move-leave-active")) return;
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
 *
 * Bug fix: the old implementation returned as soon as the range START was in
 * the first text node when end was -1, so the eraser box stopped at the end
 * of the first token. Multi-line highlights (where every non-final line uses
 * end = -1) therefore left the rest of each line visible behind the clone.
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
  let endSet = false;
  for (const tn of nodes) {
    const len = tn.data.length;
    const next = acc + len;
    if (!started && start <= next) {
      range.setStart(tn, Math.min(len, Math.max(0, start - acc)));
      started = true;
    }
    if (started && end !== -1 && end <= next) {
      range.setEnd(tn, Math.min(len, Math.max(0, end - acc)));
      endSet = true;
      break;
    }
    acc = next;
  }
  if (!started) return null;
  // end = -1 (whole rest of line) or a stale endChar past the current text →
  // close the range at the end of the LAST text node, not the first.
  if (!endSet) {
    const last = nodes[nodes.length - 1];
    range.setEnd(last, last.data.length);
  }
  return range.getBoundingClientRect();
}

/**
 * Measure character width in a given container by creating a test element.
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
 * Measure a highlight plan against the live DOM.
 *
 * Returns segments **carrying their plan line**, so erase/clone rendering
 * can never drift out of alignment when a line is skipped (e.g. an empty
 * middle line of a multi-line highlight) — the old sparse-index arrays
 * mismatched exactly in that case.
 *
 * `container` is the slide card the overlay is absolutely positioned in;
 * `codeRoot` wraps the rendered code (magic-move container or merustmar pre).
 */
export function measureHighlight(
  container: HTMLElement,
  codeRoot: HTMLElement,
  plan: HighlightPlan,
  fontSize: number,
  lineHeight: number,
): HighlightMeasurement | null {
  if (plan.lines.length === 0) return null;

  const cRect = container.getBoundingClientRect();
  const lineNodes = collectLineTextNodes(codeRoot);
  const segments: MeasuredSegment[] = [];

  for (const line of plan.lines) {
    if (line.isEmpty) continue; // nothing selected here — keep 1:1 mapping
    const nodes = lineNodes[line.lineIndex];
    if (!nodes || nodes.length === 0) continue;
    const r = rectForCharRange(nodes, line.startChar, line.endChar);
    if (!r || (r.width === 0 && r.height === 0)) continue;
    segments.push({
      line,
      rect: {
        x: r.left - cRect.left,
        y: r.top - cRect.top,
        width: Math.max(r.width, 1),
        height: Math.max(r.height, 1),
      },
    });
  }

  // Fallback: monospace math (kept for mid-animation/unmeasurable states).
  if (segments.length === 0) {
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
    for (const line of plan.lines) {
      if (line.isEmpty) continue;
      segments.push({
        line,
        rect: {
          x: ox + line.startChar * cws,
          y: oy + line.lineIndex * lh,
          width: Math.max((line.endChar - line.startChar) * cws, cws),
          height: lh,
        },
      });
    }
  }

  if (segments.length === 0) return null;

  const union = segments.reduce(
    (acc, s) => ({
      x: Math.min(acc.x, s.rect.x),
      y: Math.min(acc.y, s.rect.y),
      right: Math.max(acc.right, s.rect.x + s.rect.width),
      bottom: Math.max(acc.bottom, s.rect.y + s.rect.height),
    }),
    {
      x: segments[0].rect.x,
      y: segments[0].rect.y,
      right: segments[0].rect.x + segments[0].rect.width,
      bottom: segments[0].rect.y + segments[0].rect.height,
    },
  );

  return {
    segments,
    union: {
      x: union.x,
      y: union.y,
      width: Math.max(union.right - union.x, 1),
      height: Math.max(union.bottom - union.y, 1),
    },
  };
}
