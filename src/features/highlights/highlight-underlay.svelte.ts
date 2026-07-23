/**
 * createHighlightUnderlay — fade the ORIGINAL highlighted text chunk to
 * opacity 0 while its clone pops on top (successor to the deleted eraser
 * panels, which read as black slabs).
 *
 * Resolves the selection's text nodes per line via the shared line-nodes
 * cache — the same node lists and char-offset accumulation the Range
 * measurer uses, so the faded region matches the measured clone exactly —
 * and fades their token spans with an inline opacity transition synced to
 * the dim (dimMs + EASE_DIM). Restore fades the originals back in with the
 * same timing, so content returns smoothly across step changes and removal.
 *
 * Granularity is one token span: a partially covered token fades whole —
 * invisible in practice under the dim, and splitting text nodes would
 * disturb magic-move's keyed DOM. PRE/CODE/root ancestors are never faded
 * (a plain-text node whose parent is the code block must not blank it).
 * The leftover inline `transition` after restore is inert: token spans
 * carry no other direct opacity changes and keyframe animations (magic
 * move) take precedence over inline styles while running.
 */
import type { HighlightMeasurement } from "@/features/highlights/highlight-utils";
import { getLineTextNodes } from "$lib/lib/line-nodes-cache";

/** CSS form of EASE_DIM (see easings.ts) for the inline transition. */
const EASE_DIM_CSS = "cubic-bezier(0.25, 0.1, 0.25, 1)";

interface UseHighlightUnderlayArgs {
  codeContainer: () => HTMLElement | null;
  measurement: () => HighlightMeasurement | null;
  dimMs: () => number;
}

/** Token-level spans overlapping at least one measured selection segment. */
function collectTargets(
  root: HTMLElement,
  m: HighlightMeasurement,
): HTMLElement[] {
  const lines = getLineTextNodes(root);
  const out: HTMLElement[] = [];

  for (const seg of m.segments) {
    const { lineIndex, startChar, endChar, isEmpty } = seg.line;
    if (isEmpty || endChar <= startChar) continue;
    const nodes = lines[lineIndex];
    if (!nodes) continue;

    let acc = 0;
    for (const tn of nodes) {
      const next = acc + tn.data.length;
      // node range [acc, next) overlaps selection [startChar, endChar)?
      if (startChar < next && endChar > acc) {
        const el = tn.parentElement;
        if (
          el &&
          el !== root &&
          el.tagName !== "PRE" &&
          el.tagName !== "CODE" &&
          !out.includes(el)
        ) {
          out.push(el);
        }
      }
      acc = next;
      if (acc >= endChar) break;
    }
  }
  return out;
}

export function createHighlightUnderlay(args: UseHighlightUnderlayArgs) {
  /** Currently faded spans → captured inline opacity (restored on exit). */
  const active = new Map<HTMLElement, { opacity: string }>();

  function fade(el: HTMLElement, dimMs: number) {
    active.set(el, { opacity: el.style.opacity });
    el.style.transition = `opacity ${dimMs}ms ${EASE_DIM_CSS}`;
    el.style.opacity = "0";
  }

  function restore(el: HTMLElement, dimMs: number) {
    el.style.transition = `opacity ${dimMs}ms ${EASE_DIM_CSS}`;
    el.style.opacity = active.get(el)?.opacity ?? "";
    active.delete(el);
  }

  $effect(() => {
    const m = args.measurement();
    const root = args.codeContainer();
    const dimMs = args.dimMs();

    const targets = new Set(m && root ? collectTargets(root, m) : []);

    // Restore spans no longer covered (step change / removal).
    for (const el of [...active.keys()]) {
      if (!targets.has(el)) restore(el, dimMs);
    }
    // Fade newly covered ones (idempotent across re-measures).
    for (const el of targets) {
      if (!active.has(el)) fade(el, dimMs);
    }
  });

  // Layer unmount mid-highlight: put every original back.
  $effect(() => () => {
    const dimMs = args.dimMs();
    for (const el of [...active.keys()]) restore(el, dimMs);
  });
}
