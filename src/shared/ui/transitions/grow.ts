/**
 * Scale-to-target grow transition (used by the highlight clone layer).
 * Durations are in MILLISECONDS.
 */

export interface GrowParams {
  duration?: number;
  easing?: (t: number) => number;
  /** Scale at t=0 (intro start / outro end). */
  from?: number;
  /** Scale at t=1 (intro end / outro start). */
  to?: number;
}

export function grow(
  _node: Element,
  { duration = 400, easing = (t) => t, from = 1, to = 1.25 }: GrowParams,
) {
  return {
    duration,
    easing,
    css: (t: number) =>
      `transform: translateZ(0) scale(${from + (to - from) * t})`,
  };
}
