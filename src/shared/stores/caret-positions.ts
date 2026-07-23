/**
 * Per-slide caret memory kept outside the reactive stores.
 * Caret updates are interaction bookkeeping, not UI state.
 */
export interface CaretPosition {
  start: number;
  end: number;
}

const positions = new Map<string, CaretPosition>();

export function getCaretPosition(slideId: string): CaretPosition | undefined {
  return positions.get(slideId);
}

export function setCaretPosition(
  slideId: string,
  start: number,
  end: number,
): void {
  positions.set(slideId, { start, end });
}

export function clearCaretPositions(): void {
  positions.clear();
}
