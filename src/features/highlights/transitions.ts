/**
 * Custom Svelte transitions mirroring the framer-motion variants used by the
 * highlight layer: partial-opacity dim fade and scale-to-target grow.
 * Durations are in MILLISECONDS (Svelte), unlike framer's seconds.
 */

export interface DimFadeParams {
  duration?: number;
  easing?: (t: number) => number;
  /** Target opacity for the intro (0→target, target→0 on outro). */
  target?: number;
}

export function dimFade(
  _node: Element,
  { duration = 400, easing = (t) => t, target = 1 }: DimFadeParams,
) {
  return {
    duration,
    easing,
    css: (t: number) => `opacity: ${t * target}`,
  };
}

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
    css: (t: number) => `transform: translateZ(0) scale(${from + (to - from) * t})`,
  };
}
