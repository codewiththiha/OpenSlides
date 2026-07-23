import { EASE_DIM } from "$lib/lib/easings";

/**
 * Slide-up + settle-scale used by floating toolbars and dialogs.
 */
export function rise(
  _node: Element,
  {
    duration = 160,
    easing = EASE_DIM,
    dy = 12,
    from = 0.96,
  }: {
    duration?: number;
    easing?: (t: number) => number;
    /** Vertical offset at t=0 (px). */
    dy?: number;
    /** Scale at t=0. */
    from?: number;
  } = {},
) {
  return {
    duration,
    easing,
    css: (t: number) =>
      `opacity: ${t}; transform: translateY(${dy * (1 - t)}px) scale(${from + (1 - from) * t});`,
  };
}
