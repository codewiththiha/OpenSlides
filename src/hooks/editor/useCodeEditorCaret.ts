import { useCallback, useLayoutEffect } from "react";
import { getLocalCodeAtom } from "@/store/localCodeAtoms";
import { getCaretPosition, setCaretPosition } from "@/store/caretPositions";
import { type Snapshot } from "@/lib/editor-history";
import type { Slide } from "@/types";

interface UseCodeEditorCaretArgs {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  slideId: string | undefined;
  slide: Slide | undefined;
  editorSnapshotRef: React.MutableRefObject<Snapshot>;
}

export function useCodeEditorCaret({
  textareaRef,
  slideId,
  slide,
  editorSnapshotRef,
}: UseCodeEditorCaretArgs) {
  // ── Uncontrolled textarea, by design ─────────────
  // Fix Caret Restoration Flash: useLayoutEffect fires synchronously after DOM mutation
  // but before browser paint, so caret never flashes to end before snapping back.
  // Previously rAF caused a one-frame flash when switching slides fast.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el || !slideId) return;
    const next = getLocalCodeAtom(slideId) ?? slide?.code ?? "";
    const isNewValue = el.value !== next;
    if (isNewValue) {
      // Synchronous value update in same microtask as caret restore
      el.value = next;
    }
    const saved = getCaretPosition(slideId);
    if (saved) {
      const len = next.length;
      const start = Math.min(Math.max(saved.start, 0), len);
      const end = Math.min(Math.max(saved.end, 0), len);
      try {
        // Synchronous caret restore before paint — no flash
        el.selectionStart = start;
        el.selectionEnd = end;
      } catch {}
    } else {
      if (isNewValue) {
        try {
          // Place at end only when value actually changed and no saved pos
          el.selectionStart = el.selectionEnd = next.length;
        } catch {}
      }
    }
    editorSnapshotRef.current = {
      code: next,
      caretStart: el.selectionStart,
      caretEnd: el.selectionEnd,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slideId]);

  const saveCaret = useCallback(() => {
    const el = textareaRef.current;
    if (!el || !slideId) return;
    try {
      setCaretPosition(slideId, el.selectionStart, el.selectionEnd);
      editorSnapshotRef.current = {
        ...editorSnapshotRef.current,
        caretStart: el.selectionStart,
        caretEnd: el.selectionEnd,
      };
    } catch {}
  }, [slideId, setCaretPosition, editorSnapshotRef]);

  return saveCaret;
}
