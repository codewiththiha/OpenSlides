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
 *
 * RESTORE CONTRACT (load-bearing for slide transitions): a restored span
 * must end PRISTINE — no leftover inline `transition` — and a queued slide
 * morph must not see it mid-restore. shiki-magic-move animates slide
 * transitions with stylesheet CLASSES (`transition: all …` on
 * .shiki-magic-move-move / -leave / -enter), and inline styles override
 * stylesheet rules: a leftover inline `transition: opacity …` silently
 * disables the transform transition on exactly these spans, so previously
 * highlighted tokens TELEPORT to their final morph position while every
 * other token glides. Hence:
 *  - the inline transition is wiped once the fade-in completes
 *    (dimMs + SETTLE_BUFFER_MS), and
 *  - every restore participates in the layer's exit bookkeeping via
 *    onRestoreStart/onRestoreEnd: a slide advance queued behind the clone
 *    outro then can't start the morph until every restored span is fully
 *    visible AND pristine, however custom dim/size durations compare.
 */
import type { HighlightMeasurement } from "@/features/highlights/highlight-utils";
import { getLineTextNodes } from "$lib/lib/line-nodes-cache";

/** CSS form of EASE_DIM (see easings.ts) for the inline transition. */
const EASE_DIM_CSS = "cubic-bezier(0.25, 0.1, 0.25, 1)";

/**
 * Grace after the nominal fade-in end before a restored span's inline
 * transition is wiped and its exit released — transition completion lands
 * a frame or two after the nominal duration.
 */
const SETTLE_BUFFER_MS = 80;

interface UseHighlightUnderlayArgs {
  codeContainer: () => HTMLElement | null;
  measurement: () => HighlightMeasurement | null;
  dimMs: () => number;
  /** Exit bookkeeping arm/release (see the restore contract above). */
  onRestoreStart?: () => void;
  onRestoreEnd?: () => void;
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
  /** Restored spans whose inline transition still needs wiping → timer. */
  const settling = new Map<HTMLElement, number>();

  /** Cancel a pending settle (re-fade / re-restore) and release its exit. */
  function cancelSettle(el: HTMLElement) {
    const timer = settling.get(el);
    if (timer === undefined) return;
    window.clearTimeout(timer);
    settling.delete(el);
    args.onRestoreEnd?.();
  }

  function fade(el: HTMLElement, dimMs: number) {
    cancelSettle(el);
    active.set(el, { opacity: el.style.opacity });
    el.style.transition = `opacity ${dimMs}ms ${EASE_DIM_CSS}`;
    el.style.opacity = "0";
  }

  function restore(el: HTMLElement, dimMs: number) {
    cancelSettle(el);
    el.style.transition = `opacity ${dimMs}ms ${EASE_DIM_CSS}`;
    el.style.opacity = active.get(el)?.opacity ?? "";
    active.delete(el);
    // Arm an exit so a slide advance queued behind the clone outro only
    // starts its shiki morph once this span is fully faded back in AND
    // pristine (see the restore contract in the header).
    args.onRestoreStart?.();
    settling.set(
      el,
      window.setTimeout(() => {
        settling.delete(el);
        // Without this wipe the leftover inline transition overrides
        // shiki-magic-move's class-driven transition on the next slide
        // morph and these exact tokens teleport instead of gliding.
        el.style.transition = "";
        args.onRestoreEnd?.();
      }, dimMs + SETTLE_BUFFER_MS),
    );
  }

  $effect(() => {
    const m = args.measurement();
    const root = args.codeContainer();
    const dimMs = args.dimMs();

    const targets = new Set(m && root ? collectTargets(root, m) : []);

    // Restore spans no longer covered (step change / removal).
    let rekeyed = false;
    for (const el of [...active.keys()]) {
      if (targets.has(el)) continue;

      // Theme/language re-keys recreate token spans. The old highlighted
      // spans are torn down (disconnected, or briefly leave-classed) and so
      // drop out of `targets` even though the highlight is still active.
      // Restoring them would paint a dim, un-scaled duplicate under the live
      // clone — drop the bookkeeping and leave opacity at 0. Also record that
      // a re-key happened: the freshly mounted replacements below are then
      // hidden in one frame instead of over a 500ms fade, which (with the dim
      // overlay already up) would flash that same duplicate.
      if (
        !el.isConnected ||
        el.closest(".shiki-magic-move-leave-active, .shiki-magic-move-leave")
      ) {
        cancelSettle(el);
        active.delete(el);
        rekeyed = true;
        continue;
      }

      restore(el, dimMs);
    }
    // Cover newly highlighted spans. After a re-key these are brand-new nodes
    // sitting at opacity 1 over an already-dimmed stage, so hide them without
    // a transition; genuine first reveals / step changes keep the smooth fade.
    for (const el of targets) {
      if (active.has(el)) continue;
      if (rekeyed) {
        cancelSettle(el);
        active.set(el, { opacity: el.style.opacity });
        el.style.transition = "";
        el.style.opacity = "0";
      } else {
        fade(el, dimMs);
      }
    }
  });

  // Layer unmount mid-highlight: put every original back INSTANTLY — no
  // animation and no settle bookkeeping, since the layer's exit counter
  // dies with the component and the fail-safe owns forward progress.
  $effect(() => () => {
    for (const [el, { opacity }] of active) {
      el.style.transition = "";
      el.style.opacity = opacity;
    }
    active.clear();
    for (const timer of settling.values()) window.clearTimeout(timer);
    settling.clear();
  });
}
