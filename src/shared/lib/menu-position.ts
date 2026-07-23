/**
 * Viewport clamping for floating menus: place a measured rect near a pointer
 * point, keeping it fully inside the window. Menus open ABOVE the point and
 * flip below when there is no room.
 */
export interface ClampMenuPositionOptions {
  /** Pointer point (client coordinates). */
  x: number;
  y: number;
  /** Measured menu size. */
  width: number;
  height: number;
  /** Offset from the pointer. */
  gap?: number;
  /** Minimum distance to every viewport edge. */
  edge?: number;
}

export function clampMenuPosition({
  x,
  y,
  width,
  height,
  gap = 8,
  edge = 8,
}: ClampMenuPositionOptions): { x: number; y: number } {
  let left = x + gap;
  let top = y - height - gap;
  if (left + width > window.innerWidth - edge) {
    left = Math.max(edge, window.innerWidth - width - edge);
  }
  if (top < edge) {
    top = Math.min(window.innerHeight - height - edge, y + gap);
  }
  return { x: left, y: top };
}
