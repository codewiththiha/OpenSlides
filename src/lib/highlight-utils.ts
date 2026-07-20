/**
 * Highlight-mode geometry utilities — optimized for 60fps.
 * - Single shared Range reused
 * - WeakMap cache for line Text nodes, invalidated via MutationObserver (no textContent read)
 * - Container rect once per batch, batched reads
 * - ResizeObserver only on container
 * - LRU for char width (32 entries)
 */

import type { HighlightPlan, HighlightPlanLine } from "@/lib/highlight-tokens";
import { getLineTextNodes } from "./line-nodes-cache";
import { measureCharWidth } from "./char-width-cache";

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
