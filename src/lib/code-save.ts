/**
 * Unified code-save module — merges save-flush + code-save-queue (113 lines overlapping).
 *
 * - Serialized per-slide saves (enqueueCodeSave) to prevent out-of-order DB writes
 * - Pending-save tracking for quit flush (mark/clear/flushPendingSave)
 */

import { api } from "./tauri-api";

export type CodeWriter = (slideId: string, code: string) => Promise<unknown>;

// -- Per-slide serialized queue (previously code-save-queue.ts) --
const tails = new Map<string, Promise<void>>();
export const pendingSaveChains = () => tails.size;
export const pendingSaveChainKeys = () => Array.from(tails.keys());
export function resetCodeSaveQueue() { tails.clear(); }

function defaultWrite(slideId: string, code: string) {
  return api.updateSlideCode(slideId, code);
}

export function enqueueCodeSave(
  slideId: string,
  code: string,
  write: CodeWriter = defaultWrite,
): Promise<void> {
  const prev = tails.get(slideId) ?? Promise.resolve();
  const job = prev.then(() => write(slideId, code)).then(() => undefined);
  const tail = job.catch(() => undefined);
  tails.set(slideId, tail);
  void tail.finally(() => {
    if (tails.get(slideId) === tail) tails.delete(slideId);
  });
  return job;
}

// -- Pending-save flush for quit (previously save-flush.ts) --
let pending: { slideId: string; code: string } | null = null;

export function markSavePending(slideId: string, code: string) {
  pending = { slideId, code };
}

export function clearPendingSave(slideId: string, code: string) {
  if (pending && pending.slideId === slideId && pending.code === code) {
    pending = null;
  }
}

export async function flushPendingSave(): Promise<void> {
  const p = pending;
  if (!p) return;
  try {
    // Use the same per-slide queue as normal autosaves so the final flush
    // cannot overtake a write that is already in flight.
    await enqueueCodeSave(p.slideId, p.code);
    if (pending === p) pending = null;
  } catch {
    /* quitting anyway */
  }
}
