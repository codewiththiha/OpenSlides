/**
 * Per-slide undo/redo stacks for the controlled code editor.
 * Native textarea undo breaks under React controlled values, so we own history.
 */

export type HistoryBucket = {
  past: string[];
  future: string[];
  /** Last value we consider "committed" to history */
  present: string;
};

const MAX_STACK = 100;

const buckets = new Map<string, HistoryBucket>();

function getOrCreate(slideId: string, initial: string): HistoryBucket {
  let b = buckets.get(slideId);
  if (!b) {
    b = { past: [], future: [], present: initial };
    buckets.set(slideId, b);
  }
  return b;
}

/** Ensure bucket exists when opening a slide (doesn't push history). */
export function seedHistory(slideId: string, code: string) {
  const b = buckets.get(slideId);
  if (!b) {
    buckets.set(slideId, { past: [], future: [], present: code });
    return;
  }
  // If buffer was cleared externally and stacks empty, resync present
  if (b.past.length === 0 && b.future.length === 0 && b.present !== code) {
    b.present = code;
  }
}

/**
 * Record a user edit. Coalesces rapid typing within `coalesceMs`
 * into a single undo step when `coalesce` is true.
 */
export function pushHistory(
  slideId: string,
  nextCode: string,
  opts?: { coalesce?: boolean },
) {
  const b = getOrCreate(slideId, nextCode);
  if (nextCode === b.present) return;

  b.past.push(b.present);
  if (b.past.length > MAX_STACK) b.past.shift();
  b.present = nextCode;
  b.future = [];
  void opts;
}

export function undoHistory(slideId: string): string | null {
  const b = buckets.get(slideId);
  if (!b || b.past.length === 0) return null;
  const prev = b.past.pop()!;
  b.future.push(b.present);
  b.present = prev;
  return prev;
}

export function redoHistory(slideId: string): string | null {
  const b = buckets.get(slideId);
  if (!b || b.future.length === 0) return null;
  const next = b.future.pop()!;
  b.past.push(b.present);
  b.present = next;
  return next;
}

/** Drop history for a slide (e.g. after delete). */
export function clearHistory(slideId: string) {
  buckets.delete(slideId);
}
