/**
 * Code-editor keyboard handling: undo/redo history, the strip's global
 * search shortcut, find-bar escape, and the smart Tab handler.
 */
import { emitOpenSearch } from "$lib/lib/app-events";
import { createEditorHistory } from "@/features/editor/editor-history.svelte";
import { createTabKeyHandler } from "@/features/editor/tab-key";
import type { createCaretSync } from "@/features/editor/caret.svelte";

type CaretSyncLike = ReturnType<typeof createCaretSync>;

export function createCodeEditorKeyboard(args: {
  slideId: () => string | undefined;
  textareaEl: () => HTMLTextAreaElement | null;
  handleChange: (value: string) => void;
  saveCaret: CaretSyncLike;
  isFindOpen: () => boolean;
  closeFind: () => void;
}) {
  const { applyHistorySnapshot } = createEditorHistory({
    slideId: args.slideId,
    textarea: args.textareaEl,
    handleChange: args.handleChange,
    saveCaret: args.saveCaret,
  });

  const handleTabKey = createTabKeyHandler({
    slideId: args.slideId,
    handleChange: args.handleChange,
  });

  function handleKeyDown(e: KeyboardEvent & { currentTarget: HTMLTextAreaElement }) {
    const isMod = e.metaKey || e.ctrlKey;
    const key = e.key.toLowerCase();
    if (isMod && (key === "z" || key === "y")) {
      e.preventDefault();
      const direction = key === "y" || (key === "z" && e.shiftKey) ? "redo" : "undo";
      if (!applyHistorySnapshot(direction)) {
        document.execCommand(direction);
      }
      return;
    }
    if (isMod && key === "f" && !e.shiftKey) {
      e.preventDefault();
      emitOpenSearch();
      return;
    }
    if (e.key === "Escape" && args.isFindOpen()) {
      e.preventDefault();
      args.closeFind();
      return;
    }
    if (e.key !== "Tab" || !args.slideId()) return;
    handleTabKey(e);
  }

  return { handleKeyDown };
}
