/**
 * Highlight-mode geometry utilities — optimized for 60fps.
 * - Single shared Range reused
 * - WeakMap cache for line Text nodes, invalidated via MutationObserver (no textContent read)
 * - Container rect once per batch, batched reads
 * - ResizeObserver only on container
 * - LRU for char width (32 entries)
 */

import type { Highlight } from "@/types";
import type { HighlightPlan, HighlightPlanLine } from "@/lib/highlight-tokens";

export interface HighlightLineRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MeasuredSegment {
  line: HighlightPlanLine;
  rect: HighlightLineRect;
}

export interface HighlightMeasurement {
  segments: MeasuredSegment[];
  union: HighlightLineRect;
}

export function generateHighlightId(): string {
  return `hl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

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

/* ------------------------------------------------------------------ */
/* Line text node collection — cached per codeRoot, MutationObserver invalidation */
/* ------------------------------------------------------------------ */

interface LineNodesCache {
  lineSpans: Element[];
  nodes: Text[][];
  dirty: boolean;
}

const nodesCache = new WeakMap<HTMLElement, LineNodesCache>();

function collectLineTextNodesUncached(root: HTMLElement): Text[][] {
  const lineSpans = root.querySelectorAll("span.line");
  if (lineSpans.length > 0) {
    const lines: Text[][] = [];
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

  const current: Text[][] = [[]];
  const walk = (node: Node) => {
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as HTMLElement;
        if (el.tagName === "BR") {
          current.push([]);
          return;
        }
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
  while (current.length > 1 && current[current.length - 1].length === 0) {
    current.pop();
  }
  return current;
}

function collectLineSpanTextNodes(span: Element): Text[] {
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(span, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if ((node as Text).data) nodes.push(node as Text);
    node = walker.nextNode();
  }
  return nodes;
}

function getLineTextNodes(root: HTMLElement): Text[][] {
  const cached = nodesCache.get(root);
  if (cached && !cached.dirty) return cached.nodes;

  const lineSpans = Array.from(root.querySelectorAll("span.line"));
  if (lineSpans.length > 0 && cached && cached.lineSpans.length === lineSpans.length) {
    const nodes = lineSpans.map((span, index) =>
      span === cached.lineSpans[index]
        ? cached.nodes[index]
        : collectLineSpanTextNodes(span),
    );
    nodesCache.set(root, { lineSpans, nodes, dirty: false });
    return nodes;
  }

  const nodes = collectLineTextNodesUncached(root);
  nodesCache.set(root, { lineSpans, nodes, dirty: false });
  return nodes;
}

export function clearLineNodesCache(root: HTMLElement) {
  const cached = nodesCache.get(root);
  if (cached) cached.dirty = true;
}

/* ------------------------------------------------------------------ */
/* Range measurement — reuse single Range instance                    */
/* ------------------------------------------------------------------ */

let sharedRange: Range | null = null;
function getSharedRange(): Range {
  if (!sharedRange) sharedRange = document.createRange();
  return sharedRange;
}

function rectForCharRange(
  nodes: Text[],
  start: number,
  end: number,
  reuseRange: Range,
): DOMRect | null {
  if (nodes.length === 0) return null;
  const range = reuseRange;
  let acc = 0;
  let started = false;
  let endSet = false;

  for (const tn of nodes) {
    const len = tn.data.length;
    const next = acc + len;
    if (!started && start <= next) {
      try {
        range.setStart(tn, Math.min(len, Math.max(0, start - acc)));
      } catch {
        return null;
      }
      started = true;
    }
    if (started && end !== -1 && end <= next) {
      try {
        range.setEnd(tn, Math.min(len, Math.max(0, end - acc)));
      } catch {
        return null;
      }
      endSet = true;
      break;
    }
    acc = next;
  }

  if (!started) return null;
  if (!endSet) {
    const last = nodes[nodes.length - 1];
    try {
      range.setEnd(last, last.data.length);
    } catch {
      return null;
    }
  }

  try {
    return range.getBoundingClientRect();
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Char width cache — LRU 32 entries (16 themes × 2 font sizes)       */
/* ------------------------------------------------------------------ */

const CHAR_WIDTH_MAX = 32;
const charWidthCache = new Map<string, number>();

export function measureCharWidth(
  container: HTMLElement,
  fontSize: number,
  fontFamily: string,
): number {
  const key = `${fontSize}|${fontFamily}`;
  const cached = charWidthCache.get(key);
  if (cached !== undefined) {
    // Move to end for LRU
    charWidthCache.delete(key);
    charWidthCache.set(key, cached);
    return cached;
  }

  const test = document.createElement("span");
  test.style.position = "absolute";
  test.style.visibility = "hidden";
  test.style.whiteSpace = "pre";
  test.style.fontSize = `${fontSize}px`;
  test.style.fontFamily = fontFamily;
  test.style.lineHeight = "1";
  test.textContent = "xxxxxxxxxx";
  container.appendChild(test);
  const width = test.getBoundingClientRect().width / 10;
  container.removeChild(test);

  charWidthCache.set(key, width);
  if (charWidthCache.size > CHAR_WIDTH_MAX) {
    const firstKey = charWidthCache.keys().next().value;
    if (firstKey) charWidthCache.delete(firstKey);
  }
  return width;
}

/* ------------------------------------------------------------------ */
/* Public API: measureHighlight — batched, cached, 60fps              */
/* ------------------------------------------------------------------ */

export function measureHighlight(
  container: HTMLElement,
  codeRoot: HTMLElement,
  plan: HighlightPlan,
  fontSize: number,
  lineHeight: number,
): HighlightMeasurement | null {
  if (plan.lines.length === 0) return null;

  const cRect = container.getBoundingClientRect();
  const lineNodes = getLineTextNodes(codeRoot);
  const segments: MeasuredSegment[] = [];
  const range = getSharedRange();

  for (const line of plan.lines) {
    if (line.isEmpty) continue;
    const nodes = lineNodes[line.lineIndex];
    if (!nodes || nodes.length === 0) continue;
    const r = rectForCharRange(nodes, line.startChar, line.endChar, range);
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

  if (segments.length === 0) {
    const cws = measureCharWidth(
      codeRoot,
      fontSize,
      getComputedStyle(codeRoot).fontFamily || "ui-monospace, SFMono-Regular, Menlo, monospace",
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

/**
 * Pure-math measurement — no Range, <0.1ms, 60fps.
 */
export function measureHighlightPureMath(
  container: HTMLElement,
  codeRoot: HTMLElement,
  plan: HighlightPlan,
  fontSize: number,
  lineHeight: number,
): HighlightMeasurement | null {
  if (plan.lines.length === 0) return null;

  const cRect = container.getBoundingClientRect();
  const kRect = codeRoot.getBoundingClientRect();
  const ox = kRect.left - cRect.left;
  const oy = kRect.top - cRect.top;
  const lineH = fontSize * lineHeight;

  const charW = measureCharWidth(
    codeRoot,
    fontSize,
    getComputedStyle(codeRoot).fontFamily || "ui-monospace, SFMono-Regular, Menlo, monospace",
  );
  if (!charW || !Number.isFinite(charW)) return null;

  const segments: MeasuredSegment[] = [];
  for (const line of plan.lines) {
    if (line.isEmpty) continue;
    const x = ox + line.startChar * charW;
    const y = oy + line.lineIndex * lineH;
    const w = Math.max((line.endChar - line.startChar) * charW, charW * 0.5);
    segments.push({
      line,
      rect: { x, y, width: w, height: lineH },
    });
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
