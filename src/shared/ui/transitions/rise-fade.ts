import { EASE_DIM } from "$lib/lib/easings";

/**
 * Slide up + fade combined; supports a per-item delay for staggered intros.
 */
export function riseFade(
  _node: Element,
  {
    duration = 300,
    delay = 0,
    y = 18,
    easing = EASE_DIM,
  }: {
    duration?: number;
    delay?: number;
    /** Vertical offset at t=0 (px). */
    y?: number;
    easing?: (t: number) => number;
  } = {},
) {
  return {
    duration,
    delay,
    easing,
    css: (t: number) =>
      `opacity: ${t}; transform: translateY(${(1 - t) * y}px);`,
  };
}
