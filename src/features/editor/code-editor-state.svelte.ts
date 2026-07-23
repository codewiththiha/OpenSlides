/**
 * Element refs + transient visual state owned by CodeEditor: the three
 * scroll-synced panes and whether click-to-place highlight mode is on.
 */
import type { Snapshot } from "$lib/lib/editor-history";

export function createCodeEditorState() {
  let textareaEl = $state<HTMLTextAreaElement | null>(null);
  let preEl = $state<HTMLPreElement | null>(null);
  let gutterEl = $state<HTMLDivElement | null>(null);
  let highlightMode = $state(false);

  /** Plain mutable snapshot ref — deliberately non-reactive. */
  const editorSnapshot = {
    current: { code: "", caretStart: 0, caretEnd: 0 } as Snapshot,
  };

  return {
    get textareaEl() {
      return textareaEl;
    },
    set textareaEl(el: HTMLTextAreaElement | null) {
      textareaEl = el;
    },
    get preEl() {
      return preEl;
    },
    set preEl(el: HTMLPreElement | null) {
      preEl = el;
    },
    get gutterEl() {
      return gutterEl;
    },
    set gutterEl(el: HTMLDivElement | null) {
      gutterEl = el;
    },
    get highlightMode() {
      return highlightMode;
    },
    set highlightMode(v: boolean) {
      highlightMode = v;
    },
    editorSnapshot,
  };
}
