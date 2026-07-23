/**
 * createHighlightNav — step-wise navigation state for "sub-slide" highlights.
 *
 * Presentation flow per slide:
 *   1. → reveals highlight #1 (intro: dim + erase + scale-up)
 *   2. → plays #1's outro FULLY (dim held) and ONLY THEN #2's intro, repeat
 *   3. → after the LAST highlight, its outro plays fully and ONLY THEN
 *        does the slide advance
 *   4. ← mirrors the steps backward; ← from a clean slide lands clean
 *      on the previous slide
 *
 * Step changes are sequential (outro → intro), never crossfaded: goNext/
 * goPrev park the index at -1 and queue the next step in `pending`; the
 * layer's exit-complete signal (or the fail-safe timer) reveals it. While
 * parked, `spotlightActive` keeps the dim overlay mounted so the backdrop
 * doesn't pulse between steps.
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

type PendingNav = { advance: boolean; dir: 1 | -1; nextStep?: number };

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
  let pending = $state<PendingNav | null>(null);
  let failSafe: number = 0;

  function setIdx(v: number | ((prev: number) => number)) {
    highlightIndex = typeof v === "function" ? v(highlightIndex) : v;
  }

  /**
   * Consume whatever was queued once the outro finished: either a slide
   * advance or the next highlight step's reveal. Called by the layer's
   * `handleExitComplete` AND by a fail-safe timer: if the preview unmounts
   * mid-outro (e.g. Esc closes present mode), the exit signal may never
   * arrive — the timer guarantees forward progress and releases the input
   * lock. Whichever fires first wins.
   */
  function finishPending() {
    window.clearTimeout(failSafe);
    const p = pending;
    pending = null;

    if (p?.advance) {
      const list = args.slides();
      const i = args.currentIndex();
      const target = p.dir === 1 ? list[i + 1] : list[i - 1];
      if (target) args.setCurrentSlideId(target.id);
    } else if (p?.nextStep !== undefined) {
      // Reveal the parked step — unless its highlight was deleted mid-outro.
      const total = args.slides()[args.currentIndex()]?.highlights?.length ?? 0;
      if (p.nextStep < total) setIdx(p.nextStep);
    }
  }

  /** Arm the fail-safe using the outgoing highlight's own outro budget. */
  function armFailSafe(hl: Highlight | undefined) {
    window.clearTimeout(failSafe);
    failSafe = window.setTimeout(finishPending, outroBudget(hl));
  }

  // Cleanup on unmount (leaving the editor must not fire a stale advance).
  $effect(() => () => window.clearTimeout(failSafe));

  // Reset when the slide changes from anywhere (nav, strip click, autoplay).
  // Our own outro→advance flow sets index -1 before the slide flips, so this
  // is harmless there.
  $effect(() => {
    args.currentSlideId();
    window.clearTimeout(failSafe);
    highlightIndex = -1;
    pending = null;
  });

  /**
   * Step forward: next highlight intro, or outro-then-next-slide when the
   * highlights are exhausted. Returns false only when the presentation is finished
   * and there was nothing to do (autoplay uses this to stop).
   */
  function goNext(): boolean {
    if (pending) return true; // swallow input mid-outro

    const list = args.slides();
    const i = args.currentIndex();
    const slide = list[i];
    if (!slide) return false;

    const total = slide.highlights?.length ?? 0;
    const idx = highlightIndex;

    // More highlights to reveal → outro the current step FULLY, then
    // finishPending intros the next one (sequential, never crossfaded).
    // idx -1 = clean slide: nothing to outro, reveal instantly.
    if (idx < total - 1) {
      if (idx >= 0) {
        pending = { advance: false, dir: 1, nextStep: idx + 1 };
        armFailSafe(slide.highlights[idx]);
        setIdx(-1);
      } else {
        setIdx(idx + 1);
      }
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
        args.setCurrentSlideId(list[i + 1]!.id);
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
      // Mirror goNext: outro first, then the previous step's intro.
      pending = { advance: false, dir: -1, nextStep: idx - 1 };
      armFailSafe(list[i]?.highlights[idx]);
      setIdx(-1);
      return true;
    }
    if (idx === 0) {
      // Outro back to a clean slide (stay put).
      pending = { advance: false, dir: -1 };
      armFailSafe(list[i]?.highlights[idx]);
      setIdx(-1);
      return true;
    }
    if (i > 0) {
      // Land clean on the previous slide — highlights reveal forward only.
      args.setCurrentSlideId(list[i - 1]!.id);
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
    /**
     * True while the spotlight (dim overlay) should stay mounted: a step is
     * on screen, or a step outro is playing with another step queued behind
     * it. False during final outros (advance / back-to-clean) so the dim
     * fades out with the last highlight.
     */
    get spotlightActive() {
      return highlightIndex >= 0 || pending?.nextStep !== undefined;
    },
    goNext,
    goPrev,
    goToHighlight,
    handleExitComplete,
  };
}
