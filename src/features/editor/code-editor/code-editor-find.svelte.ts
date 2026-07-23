/**
 * Code-editor find/replace wiring: the generic find-replace controller plus
 * the window-level "find in code" event listener.
 */
import { onFindInCode } from "$lib/lib/app-events";
import { createFindReplace } from "@/features/editor/find-replace.svelte";
import type { createCaretSync } from "@/features/editor/caret.svelte";

type CaretSyncLike = ReturnType<typeof createCaretSync>;

export function createCodeEditorFind(args: {
  code: () => string;
  textareaEl: () => HTMLTextAreaElement | null;
  applyCode: (value: string) => void;
  saveCaret: CaretSyncLike;
  editorFontSize: () => number;
  lineHeight: () => number;
}) {
  const findReplace = createFindReplace({
    code: args.code,
    textarea: args.textareaEl,
    applyCode: args.applyCode,
    saveCaret: args.saveCaret,
    editorFontSize: args.editorFontSize,
    lineHeight: args.lineHeight,
  });

  $effect(() => {
    return onFindInCode((query) => findReplace.openFind(query));
  });

  return {
    findReplace,
    get isFindOpen() {
      return findReplace.open;
    },
    get closeFind() {
      return findReplace.close;
    },
    get openFind() {
      return findReplace.openFind;
    },
  };
}
