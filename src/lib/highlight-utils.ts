/**
 * Highlight-mode geometry utilities — optimized for 60fps.
 *
 * BEFORE: per measure
 *  - document.createRange() per line (10-50×)
 *  - collectLineTextNodes walked entire DOM each time (TreeWalker per span)
 *  - getBoundingClientRect() per line forces layout each call
 *  - ResizeObserver on both container + codeRoot → double triggers during drag
 *  - 12× rAF retry loop indicates race, plus 280ms setTimeout settle hack
 *
 * AFTER:
 * - Single shared Range reused across lines
 * - WeakMap cache for line Text nodes per codeRoot, invalidated on child count change
 * - Container rect measured once per batch, all line rects read in one frame
 * - ResizeObserver only on container (not codeRoot)
 * - No 12× retry, no 280ms hack — double rAF for font load
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
/* Line text node collection — cached per codeRoot                    */
/* ------------------------------------------------------------------ */

interface CachedNodes {
  nodes: Text[][];
  childSignature: number; // cheap invalidation: childNodes.length + total text length
}

const nodesCache = new WeakMap<HTMLElement, CachedNodes>();

function signatureForRoot(root: HTMLElement): number {
  // Fast signature: total child nodes + textContent length (cheap, catches edits)
  // Using textContent.length is O(n) but still cheaper than TreeWalker per line + Range per line
  // We only compute signature when cache miss/hit check; overall still less work than full walk each resize
  return root.childNodes.length * 1000000 + (root.textContent?.length ?? 0);
}

function collectLineTextNodesUncached(root: HTMLElement): Text[][] {
  // Shape A: explicit line spans (merustmar fallback / plain shiki html)
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

  // Shape B: token spans separated by <br> (shiki-magic-move)
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

function getLineTextNodes(root: HTMLElement): Text[][] {
  const sig = signatureForRoot(root);
  const cached = nodesCache.get(root);
  if (cached && cached.childSignature === sig) {
    return cached.nodes;
  }
  const nodes = collectLineTextNodesUncached(root);
  nodesCache.set(root, { nodes, childSignature: sig });
  return nodes;
}

/* ------------------------------------------------------------------ */
/* Range measurement — reuse single Range instance                    */
/* ------------------------------------------------------------------ */

// Shared Range — reused across lines to avoid 10-50 allocations per measure
let sharedRange: Range | null = null;
function getSharedRange(): Range {
  if (!sharedRange) {
    sharedRange = document.createRange();
  }
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

  // getBoundingClientRect forces layout but we batch all calls in one frame
  try {
    return range.getBoundingClientRect();
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Char width cache — already optimized                               */
/* ------------------------------------------------------------------ */

const charWidthCache = new Map<string, number>();

export function measureCharWidth(
  container: HTMLElement,
  fontSize: number,
  fontFamily: string,
): number {
  const key = `${fontSize}|${fontFamily}`;
  const cached = charWidthCache.get(key);
  if (cached !== undefined) return cached;

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

  // Single layout read for container — batch
  const cRect = container.getBoundingClientRect();
  const lineNodes = getLineTextNodes(codeRoot);
  const segments: MeasuredSegment[] = [];
  const range = getSharedRange();

  // Batch: all range creations reuse same Range object, all rect reads in one frame
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

  // Fallback: char-width math for unmeasurable states (mid-animation)
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
