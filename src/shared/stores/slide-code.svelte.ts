/**
 * slide-code — per-slide local code overrides (editor shadow while typing).
 *
 * Property-level reactivity does the bookkeeping: reading `localCode[id]`
 * in a component tracks ONLY that key — typing in slide A re-runs slide
 * A's card and nothing else.
 */

export const localCode = $state<Record<string, string>>({});

interface SlideLike {
  id: string;
  code: string;
}

/**
 * Canonical read of a slide's effective code — the editor's local override
 * wins over the persisted slide code. Call inside `$derived(...)` at the
 * component level for fine-grained tracking.
 */
export function effectiveSlideCode(slide: SlideLike | undefined): string {
  return slide ? (localCode[slide.id] ?? slide.code) : "";
}

export function getLocalCode(id: string): string | undefined {
  return localCode[id];
}

export function setLocalCode(id: string, code: string) {
  if (localCode[id] === code) return;
  localCode[id] = code;
}

export function clearLocalCode(id: string) {
  if (!(id in localCode)) return;
  delete localCode[id];
}

export function clearAllLocalCode() {
  for (const id of Object.keys(localCode)) {
    delete localCode[id];
  }
}
