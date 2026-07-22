import { useCallback, useLayoutEffect, useRef } from "react";
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
  const previousSlideIdRef = useRef<string | undefined>(undefined);

  // Keep the uncontrolled textarea synchronized before paint. A same-slide
  // external update preserves the current caret; a slide switch restores that
  // slide's saved caret position.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el || !slideId) return;

    const switchingSlides = previousSlideIdRef.current !== slideId;
    previousSlideIdRef.current = slideId;
    const localOverride = getLocalCodeAtom(slideId);
    const next = localOverride ?? slide?.code ?? "";
    const isNewValue = el.value !== next;

    if (isNewValue) {
      el.value = next;
    }

    if (switchingSlides) {
      const saved = getCaretPosition(slideId);
      if (saved) {
        const len = next.length;
        const start = Math.min(Math.max(saved.start, 0), len);
        const end = Math.min(Math.max(saved.end, 0), len);
        try {
          el.selectionStart = start;
          el.selectionEnd = end;
        } catch {}
      } else if (isNewValue) {
        try {
          el.selectionStart = el.selectionEnd = next.length;
        } catch {}
      }
    } else if (isNewValue && localOverride === undefined) {
      // A server/cache update for the currently open slide should be visible,
      // but must not reset the user's caret to a saved position or the end.
      const len = next.length;
      try {
        el.selectionStart = Math.min(el.selectionStart, len);
        el.selectionEnd = Math.min(el.selectionEnd, len);
      } catch {}
    }

    editorSnapshotRef.current = {
      code: next,
      caretStart: el.selectionStart,
      caretEnd: el.selectionEnd,
    };
  }, [slideId, slide?.code, editorSnapshotRef, textareaRef]);

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
