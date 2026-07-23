/**
 * Slide-strip keyboard batch actions. Escape cancels the selection;
 * Delete/Backspace arms the bulk-delete confirmation. Registered only while
 * multi-select is active.
 */
import { isTypingTarget } from "$lib/lib/keyboard";

interface SelectionLike {
  isMultiSelectMode: boolean;
  confirmBulkDelete: boolean;
  clearSlideSelection: () => void;
  deleteSelected: () => void;
}

export function createSlideStripKeyboardActions(args: {
  selection: () => SelectionLike;
}) {
  $effect(() => {
    const selection = args.selection();
    if (!selection.isMultiSelectMode) return;
    const onKeyDown = (event: KeyboardEvent) => {
      // A confirmation dialog is a higher-priority escape target. Let its
      // overlay consume Escape first; keep the selection toolbar intact.
      if (selection.confirmBulkDelete) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        selection.clearSlideSelection();
        return;
      }
      if (
        (event.key === "Delete" || event.key === "Backspace") &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !isTypingTarget(event.target)
      ) {
        event.preventDefault();
        event.stopPropagation();
        selection.deleteSelected();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  });
}
