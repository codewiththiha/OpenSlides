/**
 * createHighlightNav — step-wise navigation state for "sub-slide" highlights.
 *
 * Presentation flow per slide:
 *   1. → reveals highlight #1 (intro: dim + scale-up)
 *   2. → steps OVERLAP: the next highlight's intro starts together with the
 *        previous one's outro (the layer swaps once the incoming step is
 *        fully measured, so the outgoing clone ALWAYS plays its outro)
 *   3. → after the LAST highlight, its outro plays fully and ONLY THEN
 *        does the slide advance
 *   4. ← mirrors the steps backward; ← from the FIRST highlight plays its
 *        outro fully and ONLY THEN lands clean on the previous slide
 *        (mirrors the forward outro→advance)
 *
 * Slide changes that follow an outro are driven by the highlight layer's
 * exit-complete signal (via `handleExitComplete`), so the real per-highlight
 * outro durations (incl. custom transitions) are honored instead of a
 * hardcoded timeout.
 */
import type { Highlight, Slide } from "$lib/types";

/** Default outro budgets (match HighlightLayer defaults). */
const DEFAULT_DIM_MS = 500;
const DEFAULT_SIZE_MS = 600;
/** Extra breathing room on the fail-safe timer. */
const FAILSAFE_BUFFER_MS = 250;
/** Never block nav input longer than this, whatever the settings say. */
const FAILSAFE_CAP_MS = 3200;
/** Let slide morphs settle most of the way before another one can start. */
const MORPH_SETTLE_RATIO = 0.6;
const MIN_MORPH_SETTLE_MS = 100;

type PendingNav = { advance: boolean; dir: 1 | -1 };

function outroBudget(hl: Highlight | undefined): number {
  if (!hl) return DEFAULT_DIM_MS + FAILSAFE_BUFFER_MS;
  const dim = hl.useCustomTransition ? hl.dimTransition : DEFAULT_DIM_MS;
  const size = hl.sizeUpEnabled
    ? hl.useCustomTransition
      ? hl.sizeUpTransition
      : DEFAULT_SIZE_MS
    : 0;
  return Math.min(Math.max(dim, size) + FAILSAFE_BUFFER_MS, FAILSAFE_CAP_MS);
}

interface UseHighlightNavArgs {
  slides: () => Slide[];
  currentIndex: () => number;
  currentSlideId: () => string | null;
  setCurrentSlideId: (id: string | null) => void;
}

export function createHighlightNav(args: UseHighlightNavArgs) {
  /** True while an outro is playing and input is temporarily swallowed. */
  let highlightIndex = $state(-1);
  let pending: PendingNav | null = null;
  let failSafe: number = 0;
  /** Guards back-to-back slide morphs so token DOM has time to settle. */
  let morphInFlight = false;
  let morphTimer: number = 0;
  let queuedMorphNav: 1 | -1 | null = null;

  function setIdx(v: number | ((prev: number) => number)) {
    highlightIndex = typeof v === "function" ? v(highlightIndex) : v;
  }

  function completeMorphWindow() {
    morphInFlight = false;
    const dir = queuedMorphNav;
    queuedMorphNav = null;
    if (dir === 1) {
      const list = args.slides();
      const i = args.currentIndex();
      const target = list[i + 1];
      if (!target) return;
      args.setCurrentSlideId(target.id);
      markMorphStart(target.transitionDuration ?? 800);
      return;
    }
    if (dir === -1) {
      const list = args.slides();
      const i = args.currentIndex();
      const target = list[i - 1];
      if (!target) return;
      args.setCurrentSlideId(target.id);
      markMorphStart(target.transitionDuration ?? 800);
    }
  }

  function markMorphStart(durationMs: number) {
    morphInFlight = true;
    window.clearTimeout(morphTimer);
    morphTimer = window.setTimeout(
      completeMorphWindow,
      Math.max(MIN_MORPH_SETTLE_MS, durationMs * MORPH_SETTLE_RATIO),
    );
  }

  /**
   * Consume whatever slide advance was queued once the outro finished.
   * Called by the layer's `handleExitComplete` AND by a fail-safe timer:
   * if the preview unmounts mid-outro (e.g. Esc closes present mode), the
   * exit signal may never arrive — the timer guarantees forward progress
   * and releases the input lock. Whichever fires first wins.
   */
  function finishPending() {
    window.clearTimeout(failSafe);
    const p = pending;
    pending = null;

    if (p?.advance) {
      const list = args.slides();
      const i = args.currentIndex();
      const target = p.dir === 1 ? list[i + 1] : list[i - 1];
      if (!target) return;
      args.setCurrentSlideId(target.id);
      markMorphStart(target.transitionDuration ?? 800);
    }
  }

  /** Arm the fail-safe using the outgoing highlight's own outro budget. */
  function armFailSafe(hl: Highlight | undefined) {
    window.clearTimeout(failSafe);
    failSafe = window.setTimeout(finishPending, outroBudget(hl));
  }

  // Cleanup on unmount (leaving the editor must not fire a stale advance).
  $effect(() => () => {
    window.clearTimeout(failSafe);
    window.clearTimeout(morphTimer);
  });

  // Reset when the slide changes from anywhere (nav, strip click, autoplay).
  // Our own outro→advance flow sets index -1 before the slide flips, so this
  // is harmless there.
  $effect(() => {
    args.currentSlideId();
    window.clearTimeout(failSafe);
    highlightIndex = -1;
    pending = null;
    queuedMorphNav = null;
  });

  /**
   * Step forward: next highlight, or outro-then-next-slide when the
   * highlights are exhausted. Returns false only when the presentation is
   * finished and there was nothing to do (autoplay uses this to stop).
   */
  function goNext(): boolean {
    if (pending) return true; // swallow input mid-outro

    const list = args.slides();
    const i = args.currentIndex();
    const slide = list[i];
    if (!slide) return false;

    const total = slide.highlights?.length ?? 0;
    const idx = highlightIndex;

    // More highlights to reveal → step directly; the layer overlaps the
    // outgoing outro with the incoming intro once that step is measured.
    if (idx < total - 1) {
      setIdx(idx + 1);
      return true;
    }

    // Highlights exhausted (or none) → move to the next slide.
    if (i < list.length - 1) {
      if (idx >= 0) {
        // Play the last outro first; the slide advance happens in
        // finishPending once the layer's exit animations complete.
        pending = { advance: true, dir: 1 };
        armFailSafe(slide.highlights[idx]);
        setIdx(-1);
      } else {
        const target = list[i + 1]!;
        if (morphInFlight) {
          queuedMorphNav = 1;
          return true;
        }
        args.setCurrentSlideId(target.id);
        markMorphStart(target.transitionDuration ?? 800);
      }
      return true;
    }

    // Last slide: fade the active highlight out, then the deck is done.
    if (idx >= 0) {
      pending = { advance: false, dir: 1 };
      armFailSafe(slide.highlights[idx]);
      setIdx(-1);
      return true;
    }
    return false;
  }

  /** Step backward through highlights, then to the previous (clean) slide. */
  function goPrev(): boolean {
    if (pending) return true;

    const list = args.slides();
    const i = args.currentIndex();
    const idx = highlightIndex;

    if (idx > 0) {
      setIdx(idx - 1);
      return true;
    }
    if (idx === 0) {
      // Mirror the forward flow: outro the FIRST highlight fully, then move
      // to the previous slide (lands clean — highlights reveal forward only).
      // On the first slide there's nowhere to go, so just outro and stay.
      pending = { advance: i > 0, dir: -1 };
      armFailSafe(list[i]?.highlights[idx]);
      setIdx(-1);
      return true;
    }
    if (i > 0) {
      // Land clean on the previous slide — highlights reveal forward only.
      const target = list[i - 1]!;
      if (morphInFlight) {
        queuedMorphNav = -1;
        return true;
      }
      args.setCurrentSlideId(target.id);
      markMorphStart(target.transitionDuration ?? 800);
      return true;
    }
    return false;
  }

  /**
   * Fired by the highlight layer when every exit animation completed.
   * Idempotent: consumed exactly once per pending nav, so multiple mounted
   * previews (editor pane + present overlay) can share one handler safely.
   */
  function handleExitComplete() {
    finishPending();
  }

  /**
   * Jump directly to a specific highlight step (-1 = clean slide).
   * Cancels any pending slide advance and fail-safe timer.
   * Used by clickable dots and number keys 1-9.
   */
  function goToHighlight(target: number): boolean {
    if (pending) {
      window.clearTimeout(failSafe);
      pending = null;
    }
    const list = args.slides();
    const i = args.currentIndex();
    const slide = list[i];
    if (!slide) return false;
    const total = slide.highlights?.length ?? 0;
    if (total === 0) {
      setIdx(-1);
      return false;
    }
    let clamped = target;
    if (clamped < -1) clamped = -1;
    if (clamped >= total) clamped = total - 1;
    setIdx(clamped);
    return true;
  }

  return {
    get highlightIndex() {
      return highlightIndex;
    },
    goNext,
    goPrev,
    goToHighlight,
    handleExitComplete,
  };
}
