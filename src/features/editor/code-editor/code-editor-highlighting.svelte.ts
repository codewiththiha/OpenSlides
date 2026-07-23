/**
 * Highlight CRUD wiring for the code editor: which highlights belong to the
 * current slide, plus the create/update/delete + selection context menu.
 */
import { createHighlightCrud } from "@/features/highlights/highlight-crud.svelte";
import type { createCaretSync } from "@/features/editor/caret.svelte";
import type { Highlight } from "$lib/types";

type CaretSyncLike = ReturnType<typeof createCaretSync>;

export function createCodeEditorHighlighting(args: {
  projectId: string;
  slideId: () => string | undefined;
  highlights: () => Highlight[];
  code: () => string;
  highlightMode: () => boolean;
  textareaEl: () => HTMLTextAreaElement | null;
  saveCaret: CaretSyncLike;
}) {
  const crud = createHighlightCrud({
    projectId: args.projectId,
    slideId: args.slideId,
    highlights: args.highlights,
    code: args.code,
    highlightMode: args.highlightMode,
    textarea: args.textareaEl,
    saveCaret: args.saveCaret,
  });
  return crud;
}
