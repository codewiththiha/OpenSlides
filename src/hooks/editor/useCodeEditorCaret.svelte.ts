import { getLocalCode } from "@/store/slide-code.svelte";
import { getCaretPosition, setCaretPosition } from "@/store/caretPositions";
import { type Snapshot } from "@/lib/editor-history";
import type { Slide } from "@/types";

interface UseCodeEditorCaretArgs {
  textarea: () => HTMLTextAreaElement | null;
  slideId: () => string | undefined;
  slide: () => Slide | undefined;
  editorSnapshot: { current: Snapshot };
}

export function useCodeEditorCaret(args: UseCodeEditorCaretArgs) {
  let previousSlideId: string | undefined = undefined;

  // Keep the uncontrolled textarea synchronized before paint. A same-slide
  // external update preserves the current caret; a slide switch restores that
  // slide's saved caret position.
  $effect(() => {
    const el = args.textarea();
    const slideId = args.slideId();
    const slideCode = args.slide()?.code;
    if (!el || !slideId) return;

    const switchingSlides = previousSlideId !== slideId;
    previousSlideId = slideId;
    const localOverride = getLocalCode(slideId);
    const next = localOverride ?? slideCode ?? "";
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
        } catch {
          /* ignore */
        }
      } else if (isNewValue) {
        try {
          el.selectionStart = el.selectionEnd = next.length;
        } catch {
          /* ignore */
        }
      }
    } else if (isNewValue && localOverride === undefined) {
      // A server/cache update for the currently open slide should be visible,
      // but must not reset the user's caret to a saved position or the end.
      const len = next.length;
      try {
        el.selectionStart = Math.min(el.selectionStart, len);
        el.selectionEnd = Math.min(el.selectionEnd, len);
      } catch {
        /* ignore */
      }
    }

    args.editorSnapshot.current = {
      code: next,
      caretStart: el.selectionStart,
      caretEnd: el.selectionEnd,
    };
  });

  function saveCaret() {
    const el = args.textarea();
    const slideId = args.slideId();
    if (!el || !slideId) return;
    try {
      setCaretPosition(slideId, el.selectionStart, el.selectionEnd);
      args.editorSnapshot.current = {
        ...args.editorSnapshot.current,
        caretStart: el.selectionStart,
        caretEnd: el.selectionEnd,
      };
    } catch {
      /* ignore */
    }
  }

  return saveCaret;
}
