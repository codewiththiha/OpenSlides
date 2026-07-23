/**
 * Prev/next slide navigation from the editor header: stash the caret, flush
 * the pending save, then move the selection.
 */
import { setCaretPosition } from "$lib/stores/caret-positions";
import { setCurrentSlideId } from "$lib/stores/ui-state.svelte";
import type { Slide } from "$lib/types";
import type { createCodeSave } from "../save.svelte";

export function createCodeEditorSlideNav(args: {
  slides: () => Slide[];
  currentIndex: () => number;
  slideId: () => string | undefined;
  textareaEl: () => HTMLTextAreaElement | null;
  save: Pick<ReturnType<typeof createCodeSave>, "flush">;
}) {
  function goSlide(dir: -1 | 1) {
    try {
      const el = args.textareaEl();
      const slideId = args.slideId();
      if (el && slideId) {
        setCaretPosition(slideId, el.selectionStart, el.selectionEnd);
      }
    } catch {
      /* ignore */
    }
    args.save.flush();
    const next = args.slides()[args.currentIndex() + dir];
    if (next) setCurrentSlideId(next.id);
  }

  return { goSlide };
}
