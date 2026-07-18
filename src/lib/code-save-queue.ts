/**
 * Serialized, per-slide code saves.
 *
 * CodeEditor auto-saves with a 500ms debounce, but the debounce orders
 * nothing: two saves can be in flight at once, each an independent
 * `invoke()` handled on the Rust async runtime against a 5-connection
 * SQLite pool. Execution and completion order across pooled connections
 * is not guaranteed, so an OLDER value can win:
 *   - the DB row (later `UPDATE` overwrites the newer value), and
 *   - the query cache (`useUpdateSlideCode.onSuccess` stamps whatever the
 *     mutation carried). Once the `localCode` shadow is cleared, the
 *     editor renders that older string, React commits a *different*
 *     textarea value, and WKWebView resets the caret to the end.
 *     (User-reported: "type one char, cursor teleports to the end".)
 *
 * The fix at the root: chain writes per slide so DB application order and
 * completion order are exactly the schedule order. A failed save does not
 * block later ones; each caller still observes its own rejection. The
 * module-level map is bounded by entry count (one tail per slide), and
 * entries are dropped once the tail settles — see EnqueueDoc below.
 */
import { api } from "./tauri-api";

export type CodeWriter = (slideId: string, code: string) => Promise<unknown>;

/** Newest scheduled write per slide; never rejects, so chains never wedge. */
const tails = new Map<string, Promise<void>>();

function defaultWrite(slideId: string, code: string): Promise<unknown> {
  return api.updateSlideCode(slideId, code);
}

/**
 * Enqueue a code save for `slideId`, executed strictly after all saves
 * previously enqueued for the SAME slide (other slides are unaffected).
 * Resolves when THIS write completes; rejects if THIS write fails.
 * `write` is injectable for tests (and for the quit-flush path, if ever
 * needed) — production callers use the default Tauri command.
 */
export function enqueueCodeSave(
  slideId: string,
  code: string,
  write: CodeWriter = defaultWrite,
): Promise<void> {
  const prev = tails.get(slideId) ?? Promise.resolve();
  // `prev` never rejects (it is a settled tail), so this always runs in order.
  const job: Promise<void> = prev
    .then(() => write(slideId, code))
    .then(() => undefined);
  const tail = job.catch(() => undefined);
  tails.set(slideId, tail);
  // Drop the entry once this is still the newest tail and it has settled —
  // keeps the map bounded by the number of slides, not the number of saves.
  void tail.finally(() => {
    if (tails.get(slideId) === tail) tails.delete(slideId);
  });
  return job;
}

/** Test introspection only: number of slide chains currently tracked. */
export function pendingSaveChains(): number {
  return tails.size;
}
