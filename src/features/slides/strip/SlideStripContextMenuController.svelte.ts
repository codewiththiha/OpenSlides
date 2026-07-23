/**
 * Slide-strip context menu state. Opening the menu selects the target slide;
 * while multi-select is armed, clicks here feed the selection instead.
 */
import { setCurrentSlideId } from "$lib/stores/ui-state.svelte";
import type { Slide } from "$lib/types";

export interface SlideStripMenuState {
  slide: Slide;
  title: string;
  position: { x: number; y: number };
}

export function createSlideStripContextMenu(args: {
  isMultiSelectMode: () => boolean;
  toggleSlideSelection: (id: string) => void;
}) {
  let menu = $state<SlideStripMenuState | null>(null);

  function open(event: MouseEvent, slide: Slide, title: string) {
    setCurrentSlideId(slide.id);
    if (args.isMultiSelectMode()) {
      args.toggleSlideSelection(slide.id);
      return;
    }
    menu = { slide, title, position: { x: event.clientX, y: event.clientY } };
  }

  function close() {
    menu = null;
  }

  function updatePosition(position: { x: number; y: number }) {
    if (menu) menu = { ...menu, position };
  }

  return {
    get menu() {
      return menu;
    },
    open,
    close,
    updatePosition,
  };
}
