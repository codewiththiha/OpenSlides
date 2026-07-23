import { LruMap } from "./lru-map";

export interface Snapshot {
  code: string;
  caretStart: number;
  caretEnd: number;
}

interface Entry {
  before: Snapshot;
  after: Snapshot;
  timestamp: number;
  coalescible: boolean;
}

interface History {
  undo: Entry[];
  redo: Entry[];
}

const MAX_SLIDES = 20;
const histories = new LruMap<string, History>(MAX_SLIDES);
const MAX_SNAPSHOTS = 100;
const COALESCE_MS = 800;
let applyingHistory = false;

function getHistory(slideId: string): History {
  let history = histories.get(slideId);
  if (!history) {
    history = { undo: [], redo: [] };
    histories.set(slideId, history);
  }
  return history;
}

function isSingleCharacterEdit(before: string, after: string): boolean {
  let prefix = 0;
  while (
    prefix < before.length &&
    prefix < after.length &&
    before[prefix] === after[prefix]
  )
    prefix++;
  let beforeEnd = before.length;
  let afterEnd = after.length;
  while (
    beforeEnd > prefix &&
    afterEnd > prefix &&
    before[beforeEnd - 1] === after[afterEnd - 1]
  ) {
    beforeEnd--;
    afterEnd--;
  }
  const removed = before.slice(prefix, beforeEnd);
  const inserted = after.slice(prefix, afterEnd);
  if (/[\n\t]/.test(removed) || /[\n\t]/.test(inserted)) return false;
  return (
    (removed.length === 0 && inserted.length === 1) ||
    (removed.length === 1 && inserted.length === 0)
  );
}

export function record(
  slideId: string,
  before: Snapshot,
  after: Snapshot,
): void {
  if (applyingHistory || before.code === after.code) return;
  const history = getHistory(slideId);
  const now = Date.now();
  const coalescible = isSingleCharacterEdit(before.code, after.code);
  const last = history.undo[history.undo.length - 1];

  if (
    last &&
    coalescible &&
    last.coalescible &&
    now - last.timestamp < COALESCE_MS
  ) {
    last.after = after;
    last.timestamp = now;
    history.redo.length = 0;
    return;
  }

  history.undo.push({ before, after, timestamp: now, coalescible });
  history.redo.length = 0;
  if (history.undo.length > MAX_SNAPSHOTS) history.undo.shift();
}

export function undo(slideId: string): Snapshot | null {
  const history = getHistory(slideId);
  const entry = history.undo.pop();
  if (!entry) return null;
  history.redo.push(entry);
  return entry.before;
}

export function redo(slideId: string): Snapshot | null {
  const history = getHistory(slideId);
  const entry = history.redo.pop();
  if (!entry) return null;
  history.undo.push(entry);
  return entry.after;
}

export function withoutRecording<T>(fn: () => T): T {
  applyingHistory = true;
  try {
    return fn();
  } finally {
    applyingHistory = false;
  }
}
