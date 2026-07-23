import {
  redo as redoEditorHistory,
  undo as undoEditorHistory,
  withoutRecording,
} from "$lib/lib/editor-history";

export function useEditorHistory(args: {
  slideId: () => string | undefined;
  textarea: () => HTMLTextAreaElement | null;
  handleChange: (value: string) => void;
  saveCaret: () => void;
}) {
  function applyHistorySnapshot(direction: "undo" | "redo"): boolean {
    const el = args.textarea();
    const slideId = args.slideId();
    if (!el || !slideId || document.activeElement !== el) return false;
    const snapshot =
      direction === "undo" ? undoEditorHistory(slideId) : redoEditorHistory(slideId);
    if (!snapshot) return false;
    withoutRecording(() => {
      el.value = snapshot.code;
      try {
        el.selectionStart = snapshot.caretStart;
        el.selectionEnd = snapshot.caretEnd;
      } catch {
        /* ignore */
      }
      args.handleChange(snapshot.code);
    });
    args.saveCaret();
    return true;
  }

  $effect(() => {
    const exec = (direction: "undo" | "redo") => {
      const el = args.textarea();
      if (!el || document.activeElement !== el) return;
      if (!applyHistorySnapshot(direction) && typeof document.execCommand === "function") {
        document.execCommand(direction);
      }
    };
    const onUndo = () => exec("undo");
    const onRedo = () => exec("redo");
    window.addEventListener("openslides:undo", onUndo);
    window.addEventListener("openslides:redo", onRedo);
    return () => {
      window.removeEventListener("openslides:undo", onUndo);
      window.removeEventListener("openslides:redo", onRedo);
    };
  });

  return { applyHistorySnapshot };
}
