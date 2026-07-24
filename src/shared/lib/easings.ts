/**
 * Cubic-bezier easing curves for highlight animations (default `ease` and
 * `backOut`), implemented as a UnitBezier solver so timings stay
 * sample-identical across runs.
 */

export type EasingFn = (t: number) => number;

function cubicBezier(
  p1x: number,
  p1y: number,
  p2x: number,
  p2y: number,
): EasingFn {
  const cx = 3 * p1x;
  const bx = 3 * (p2x - p1x) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * p1y;
  const by = 3 * (p2y - p1y) - cy;
  const ay = 1 - cy - by;

  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const sampleDX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;

  function solveX(x: number): number {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const err = sampleX(t) - x;
      if (Math.abs(err) < 1e-6) return t;
      const d = sampleDX(t);
      if (Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    // bisection fallback
    let lo = 0;
    let hi = 1;
    t = x;
    while (lo < hi) {
      const v = sampleX(t);
      if (Math.abs(v - x) < 1e-6) return t;
      if (x > v) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
      if (hi - lo < 1e-6) break;
    }
    return t;
  }

  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    return sampleY(solveX(x));
  };
}

/** framer default ease — used for dim/opacity fades. */
export const EASE_DIM: EasingFn = cubicBezier(0.25, 0.1, 0.25, 1);
/** framer backOut — used for the highlight scale pop. */
export const EASE_SCALE: EasingFn = cubicBezier(0.34, 1.56, 0.64, 1);
/** Bouncy ease-out for pop-from-below entrances. */
export const EASE_BOUNCE_OUT: EasingFn = cubicBezier(0.34, 1.8, 0.64, 1);
