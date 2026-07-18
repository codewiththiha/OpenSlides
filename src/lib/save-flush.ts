/**
 * Pending-save flush for the abrupt-quit path.
 *
 * CodeEditor auto-saves with a 500ms debounce; if the app quits inside that
 * window the tail of a keystroke burst never reaches SQLite. The debounced
 * function itself is fire-and-forget (`useMutation`), so even a flush()
 * gives no completion signal.
 *
 * This module tracks the last scheduled save explicitly. When Rust
 * intercepts a quit (CloseRequested / ExitRequested → "app://quit-request"),
 * the listener installed in main.tsx awaits `flushPendingSave()` — a direct
 * `api.updateSlideCode` call with a real completion signal — and only then
 * lets the process exit via `finish_quit`.
 */
import { api } from "./tauri-api";

let pending: { slideId: string; code: string } | null = null;

/** Mark the newest scheduled-but-maybe-unsaved edit (call at schedule time). */
export function markSavePending(slideId: string, code: string) {
  pending = { slideId, code };
}

/** Clear after a successful save — but never drop a NEWER pending edit
 *  for the same slide (keystrokes may have continued after the save that
 *  just resolved). */
export function clearPendingSave(slideId: string, code: string) {
  if (pending && pending.slideId === slideId && pending.code === code) {
    pending = null;
  }
}

/** Write the newest pending edit out NOW and return a completion signal.
 *  A concurrent debounced write of the same (slideId, code) is a harmless
 *  idempotent duplicate UPDATE. */
export async function flushPendingSave(): Promise<void> {
  const p = pending;
  if (!p) return;
  try {
    await api.updateSlideCode(p.slideId, p.code);
    if (pending === p) pending = null;
  } catch {
    /* quitting anyway — nothing useful to do with a write error here */
  }
}
