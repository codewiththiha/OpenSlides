/**
 * useHighlightNav — step-wise navigation state for "sub-slide" highlights.
 *
 * Presentation flow per slide:
 *   1. → reveals highlight #1 (intro: dim + erase + scale-up)
 *   2. → plays #1's outro while #2's intro plays (crossfade), repeat
 *   3. → after the LAST highlight, its outro plays fully and ONLY THEN
 *        does the slide advance
 *   4. ← mirrors the steps backward; ← from a clean slide lands clean
 *      on the previous slide
 *
 * Slide changes that follow an outro are driven by the highlight layer's
 * AnimatePresence `onExitComplete` (via `handleExitComplete`), so the
 * real per-highlight outro durations (incl. custom transitions) are honored
 * instead of a hardcoded timeout.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { Highlight, Slide } from "@/types";

/** Default outro budgets (match HighlightLayer defaults). */
const DEFAULT_DIM_MS = 500;
const DEFAULT_SIZE_MS = 600;
/** Extra breathing room on the fail-safe timer. */
const FAILSAFE_BUFFER_MS = 250;
/** Never block nav input longer than this, whatever the settings say. */
const FAILSAFE_CAP_MS = 3200;

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
  slides: Slide[];
  currentIndex: number;
  /** Slide id — resets highlight state when it changes externally. */
  currentSlideId: string | null;
  setCurrentSlideId: (id: string) => void;
}

interface PendingNav {
  /** Advance to a sibling slide once the outro finishes. */
  advance: boolean;
  dir: 1 | -1;
}

export function useHighlightNav({
  slides,
  currentIndex,
  currentSlideId,
  setCurrentSlideId,
}: UseHighlightNavArgs) {
  const [highlightIndex, setHighlightIndexState] = useState(-1);
  /** True while an outro is playing and input is temporarily swallowed. */
  const [isAdvancing, setIsAdvancing] = useState(false);

  const highlightIndexRef = useRef(-1);
  const slidesRef = useRef(slides);
  const indexRef = useRef(currentIndex);
  const pendingRef = useRef<PendingNav | null>(null);
  const failSafeRef = useRef(0);

  slidesRef.current = slides;
  indexRef.current = currentIndex;

  /** Ref-synced setter so callbacks stay referentially stable. */
  const setIdx = useCallback(
    (v: number | ((prev: number) => number)) => {
      const next =
        typeof v === "function" ? v(highlightIndexRef.current) : v;
      highlightIndexRef.current = next;
      setHighlightIndexState(next);
    },
    [],
  );

  /**
   * Consume whatever slide advance was queued once the outro finished.
   * Called by the layer's `onExitComplete` AND by a fail-safe timer:
   * if the preview unmounts mid-outro (e.g. Esc closes present mode), the
   * exit signal may never arrive — the timer guarantees forward progress
   * and releases the input lock. Whichever fires first wins.
   */
  const finishPending = useCallback(() => {
    window.clearTimeout(failSafeRef.current);
    const pending = pendingRef.current;
    pendingRef.current = null;
    setIsAdvancing(false);

    if (pending?.advance) {
      const list = slidesRef.current;
      const i = indexRef.current;
      const target = pending.dir === 1 ? list[i + 1] : list[i - 1];
      if (target) setCurrentSlideId(target.id);
    }
  }, [setCurrentSlideId]);

  /** Arm the fail-safe using the outgoing highlight's own outro budget. */
  const armFailSafe = useCallback(
    (hl: Highlight | undefined) => {
      window.clearTimeout(failSafeRef.current);
      failSafeRef.current = window.setTimeout(finishPending, outroBudget(hl));
    },
    [finishPending],
  );

  // Cleanup on unmount (leaving the editor must not fire a stale advance).
  useEffect(() => () => window.clearTimeout(failSafeRef.current), []);

  // Reset when the slide changes from anywhere (nav, strip click, autoplay).
  // Our own outro→advance flow sets index -1 before the slide flips, so this
  // is harmless there.
  useEffect(() => {
    window.clearTimeout(failSafeRef.current);
    highlightIndexRef.current = -1;
    setHighlightIndexState(-1);
    pendingRef.current = null;
    setIsAdvancing(false);
  }, [currentSlideId]);

  /**
   * Step forward: next highlight intro, or outro-then-next-slide when the
   * highlights are exhausted. Returns false only when the deck is finished
   * and there was nothing to do (autoplay uses this to stop).
   */
  const goNext = useCallback((): boolean => {
    if (pendingRef.current) return true; // swallow input mid-outro

    const list = slidesRef.current;
    const i = indexRef.current;
    const slide = list[i];
    if (!slide) return false;

    const total = slide.highlights?.length ?? 0;
    const idx = highlightIndexRef.current;

    // More highlights to reveal → intro the next one (layer crossfades).
    if (idx < total - 1) {
      setIdx(idx + 1);
      return true;
    }

    // Highlights exhausted (or none) → move to the next slide.
    if (i < list.length - 1) {
      if (idx >= 0) {
        // Play the last outro first; the slide advance happens in
        // finishPending once the layer's exit animations complete.
        pendingRef.current = { advance: true, dir: 1 };
        setIsAdvancing(true);
        armFailSafe(slide.highlights[idx]);
        setIdx(-1);
      } else {
        setCurrentSlideId(list[i + 1].id);
      }
      return true;
    }

    // Last slide: fade the active highlight out, then the deck is done.
    if (idx >= 0) {
      pendingRef.current = { advance: false, dir: 1 };
      setIsAdvancing(true);
      armFailSafe(slide.highlights[idx]);
      setIdx(-1);
      return true;
    }
    return false;
  }, [setIdx, setCurrentSlideId, armFailSafe]);

  /** Step backward through highlights, then to the previous (clean) slide. */
  const goPrev = useCallback((): boolean => {
    if (pendingRef.current) return true;

    const list = slidesRef.current;
    const i = indexRef.current;
    const idx = highlightIndexRef.current;

    if (idx > 0) {
      setIdx(idx - 1);
      return true;
    }
    if (idx === 0) {
      // Outro back to a clean slide (stay put).
      pendingRef.current = { advance: false, dir: -1 };
      setIsAdvancing(true);
      armFailSafe(list[i]?.highlights[idx]);
      setIdx(-1);
      return true;
    }
    if (i > 0) {
      // Land clean on the previous slide — highlights reveal forward only.
      setCurrentSlideId(list[i - 1].id);
      return true;
    }
    return false;
  }, [setIdx, setCurrentSlideId, armFailSafe]);

  /**
   * Fired by the highlight layer when every exit animation completed.
   * Idempotent: consumed exactly once per pending nav, so multiple mounted
   * previews (editor pane + present overlay) can share one handler safely.
   */
  const handleExitComplete = useCallback(() => {
    finishPending();
  }, [finishPending]);

  return {
    highlightIndex,
    isAdvancing,
    goNext,
    goPrev,
    handleExitComplete,
  };
}
