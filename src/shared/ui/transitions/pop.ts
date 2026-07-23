import { EASE_DIM } from "$lib/lib/easings";

/**
 * Small scale-up + fade used by floating menus.
 */
export function pop(
  _node: Element,
  {
    duration = 150,
    easing = EASE_DIM,
    from = 0.95,
    dy = -4,
  }: {
    duration?: number;
    easing?: (t: number) => number;
    /** Scale at t=0. */
    from?: number;
    /** Vertical offset at t=0 (px). */
    dy?: number;
  } = {},
) {
  return {
    duration,
    easing,
    css: (t: number) =>
      `opacity: ${t}; transform: scale(${from + (1 - from) * t}) translateY(${dy * (1 - t)}px);`,
  };
}
