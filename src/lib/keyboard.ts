/**
 * Shared keyboard guards for global shortcut handlers.
 */

/**
 * True when the event target is a text entry surface where keys should type
 * (or move the caret) rather than trigger app shortcuts: native form fields,
 * contentEditable, ARIA textboxes and CodeMirror-style editors.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return Boolean(
    target.closest("[contenteditable='true'], [role='textbox'], .cm-editor, .cm-content"),
  );
}

/** The platform modifier for app shortcuts (⌘ on macOS, Ctrl elsewhere). */
export function isModKey(e: KeyboardEvent | { metaKey: boolean; ctrlKey: boolean }): boolean {
  return e.metaKey || e.ctrlKey;
}
