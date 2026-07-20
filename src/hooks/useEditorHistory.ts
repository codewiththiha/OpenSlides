import { useCallback, useEffect } from "react";
import { redo as redoEditorHistory, undo as undoEditorHistory, withoutRecording } from "@/lib/editor-history";

export function useEditorHistory({
  slideId,
  textareaRef,
  handleChange,
  saveCaret,
}: {
  slideId: string | undefined;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  handleChange: (value: string) => void;
  saveCaret: () => void;
}) {
  const applyHistorySnapshot = useCallback((direction: "undo" | "redo") => {
    const el = textareaRef.current;
    if (!el || !slideId || document.activeElement !== el) return false;
    const snapshot = direction === "undo" ? undoEditorHistory(slideId) : redoEditorHistory(slideId);
    if (!snapshot) return false;
    withoutRecording(() => {
      el.value = snapshot.code;
      try { el.selectionStart = snapshot.caretStart; el.selectionEnd = snapshot.caretEnd; } catch {}
      handleChange(snapshot.code);
    });
    saveCaret();
    return true;
  }, [slideId, textareaRef, handleChange, saveCaret]);

  useEffect(() => {
    const exec = (direction: "undo" | "redo") => {
      const el = textareaRef.current;
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
  }, [applyHistorySnapshot, textareaRef]);

  return { applyHistorySnapshot };
}
