/**
 * localCodeAtoms — per-slide atoms to avoid re-render storm.
 *
 * BEFORE: localCode was a single Record<string,string> in Zustand.
 * Every keystroke did { ...localCode, [id]: code } creating a new object.
 * Even with selector s => s.localCode[slide.id], Zustand still notifies
 * ALL subscribers (20 selector calls per keystroke) and any parent that
 * selects the whole object re-renders everything.
 *
 * AFTER: per-slide external store. Each slide ID has its own Set of listeners.
 * Only the card that owns that ID gets notified. Typing in Slide A → 1 re-render,
 * not 20. This is true per-slide atoms.
 *
 * UI components should use useLocalCodeAtom — no Zustand mirror, zero O(n) spread.
 */

import { useSyncExternalStore, useCallback } from "react";

type Listener = () => void;

const codeMap = new Map<string, string>();
const listenersMap = new Map<string, Set<Listener>>();

function getListeners(id: string): Set<Listener> {
  let set = listenersMap.get(id);
  if (!set) {
    set = new Set();
    listenersMap.set(id, set);
  }
  return set;
}

export function getLocalCodeAtom(id: string): string | undefined {
  return codeMap.get(id);
}

export function setLocalCodeAtom(id: string, code: string) {
  const prev = codeMap.get(id);
  if (prev === code) return;
  codeMap.set(id, code);
  getListeners(id).forEach((l) => l());
}

export function clearLocalCodeAtom(id: string) {
  if (!codeMap.has(id)) return;
  codeMap.delete(id);
  getListeners(id).forEach((l) => l());
}

export function clearAllLocalCodeAtoms() {
  const ids = Array.from(codeMap.keys());
  codeMap.clear();
  ids.forEach((id) => {
    getListeners(id).forEach((l) => l());
  });
}

export function subscribeLocalCodeAtom(id: string, cb: Listener) {
  const set = getListeners(id);
  set.add(cb);
  return () => {
    set.delete(cb);
    if (set.size === 0) {
      listenersMap.delete(id);
    }
  };
}

/**
 * Hook: subscribe only to a single slide's local code.
 * Returns undefined when no override.
 */
export function useLocalCodeAtom(slideId: string | undefined): string | undefined {
  const subscribe = useCallback(
    (cb: Listener) => {
      if (!slideId) return () => {};
      return subscribeLocalCodeAtom(slideId, cb);
    },
    [slideId]
  );

  const getSnapshot = useCallback(() => {
    if (!slideId) return undefined;
    return getLocalCodeAtom(slideId);
  }, [slideId]);

  // For SSR/hydration, getServerSnapshot = getSnapshot
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
