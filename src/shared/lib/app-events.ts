/**
 * Typed window-level app events. Emitters and listeners both go through
 * these helpers so the event names (and payloads) exist in exactly one
 * place. Listener helpers return an unlisten function for `$effect` cleanup.
 */

export const APP_EVENTS = {
  openSearch: "openslides:open-search",
  findInCode: "openslides:find-in-code",
  undo: "openslides:undo",
  redo: "openslides:redo",
} as const;

export function emitOpenSearch(): void {
  window.dispatchEvent(new Event(APP_EVENTS.openSearch));
}

export function onOpenSearch(handler: () => void): () => void {
  window.addEventListener(APP_EVENTS.openSearch, handler);
  return () => window.removeEventListener(APP_EVENTS.openSearch, handler);
}

export function emitFindInCode(query: string): void {
  window.dispatchEvent(
    new CustomEvent(APP_EVENTS.findInCode, { detail: { query } }),
  );
}

export function onFindInCode(handler: (query: string | undefined) => void): () => void {
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<{ query?: string }>).detail;
    handler(detail?.query);
  };
  window.addEventListener(APP_EVENTS.findInCode, listener);
  return () => window.removeEventListener(APP_EVENTS.findInCode, listener);
}

export function emitUndo(): void {
  window.dispatchEvent(new Event(APP_EVENTS.undo));
}

export function emitRedo(): void {
  window.dispatchEvent(new Event(APP_EVENTS.redo));
}

export function onUndoRedo(onUndo: () => void, onRedo: () => void): () => void {
  window.addEventListener(APP_EVENTS.undo, onUndo);
  window.addEventListener(APP_EVENTS.redo, onRedo);
  return () => {
    window.removeEventListener(APP_EVENTS.undo, onUndo);
    window.removeEventListener(APP_EVENTS.redo, onRedo);
  };
}
