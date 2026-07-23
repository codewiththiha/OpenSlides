import { PROJECT_CARD_WIDTH, PROJECT_CARD_HEIGHT } from "./layout";

/**
 * Pure stack-fan geometry (§6.10): where the spread centers itself and how
 * large its highlight wrapper is. Kept separate from the component's motion
 * choreography so the numbers stay testable and named.
 */

/** Horizontal gap between fanned cards. */
const FAN_STEP_X = 85;
/** Vertical arc: cards further from the center dip this much per step. */
const FAN_CURVE_Y_PER_INDEX = 12;
/** Breathing room around the outermost cards. */
const FAN_PADDING = 80;

/** Clamp margins keeping the fan on-screen. */
const VIEWPORT_MARGIN_X = 240;
const VIEWPORT_MARGIN_TOP = 180;
const VIEWPORT_MARGIN_BOTTOM = 200;

/** Approx deck height when its rect hasn't been measured yet. */
const DECK_HEIGHT_FALLBACK = 150;

export function stackFanCenter(args: {
  deckRect: DOMRect | null;
  viewportW: number;
  viewportH: number;
}): { x: number; y: number } {
  const { deckRect, viewportW, viewportH } = args;
  return {
    x: Math.max(
      VIEWPORT_MARGIN_X,
      Math.min(
        viewportW - VIEWPORT_MARGIN_X,
        (deckRect?.left ?? viewportW / 2) +
          (deckRect?.width ?? PROJECT_CARD_WIDTH) / 2,
      ),
    ),
    y: Math.max(
      VIEWPORT_MARGIN_TOP,
      Math.min(
        viewportH - VIEWPORT_MARGIN_BOTTOM,
        (deckRect?.top ?? viewportH / 2) +
          (deckRect?.height ?? DECK_HEIGHT_FALLBACK) / 2,
      ),
    ),
  };
}

export function stackFanSize(total: number): { width: number; height: number } {
  return {
    width: PROJECT_CARD_WIDTH + (total - 1) * FAN_STEP_X + FAN_PADDING,
    height:
      PROJECT_CARD_HEIGHT +
      Math.abs((total - 1) / 2) * FAN_CURVE_Y_PER_INDEX +
      FAN_PADDING,
  };
}
