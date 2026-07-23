import { EASE_DIM } from "$lib/lib/easings";

/**
 * Height 0→auto + fade, for rows that grow open.
 */
export function expand(
  node: Element,
  {
    duration = 150,
    easing = EASE_DIM,
  }: { duration?: number; easing?: (t: number) => number } = {},
) {
  const el = node as HTMLElement;
  const height = el.offsetHeight;
  const opacity = +getComputedStyle(el).opacity;
  return {
    duration,
    easing,
    css: (t: number) =>
      `overflow: hidden; height: ${t * height}px; opacity: ${t * opacity}`,
  };
}
