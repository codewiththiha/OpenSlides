/**
 * Code-editor apply path: every edit (typing, replace-all, undo, tab edits)
 * flows through here — history record, local code shadow, save scheduling.
 */
import {
  record as recordEditorHistory,
  type Snapshot,
} from "$lib/lib/editor-history";
import { markSavePending } from "$lib/lib/code-save";
import { setLocalCode } from "$lib/stores/slide-code.svelte";
import type { createCodeEditorState } from "../code-editor-state.svelte";
import type { createCodeSave } from "../save.svelte";

export function createCodeEditorApply(args: {
  slideId: () => string | undefined;
  textareaEl: () => HTMLTextAreaElement | null;
  editorSnapshot: ReturnType<typeof createCodeEditorState>["editorSnapshot"];
  save: Pick<ReturnType<typeof createCodeSave>, "schedule">;
}) {
  function applyCode(value: string, beforeOverride?: Snapshot) {
    const slideId = args.slideId();
    if (!slideId) return;
    const el = args.textareaEl();
    const before = beforeOverride ?? args.editorSnapshot.current;
    const caretStart = el?.selectionStart ?? value.length;
    const caretEnd = el?.selectionEnd ?? caretStart;
    const after = { code: value, caretStart, caretEnd };
    recordEditorHistory(slideId, before, after);
    args.editorSnapshot.current = after;
    setLocalCode(slideId, value);
    markSavePending(slideId, value);
    args.save.schedule(slideId, value);
  }

  return { applyCode };
}
