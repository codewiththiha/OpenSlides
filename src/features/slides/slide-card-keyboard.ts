import { setCurrentSlideId } from "$lib/stores/ui-state.svelte";
import type { SlideCardActions } from "./slide-card-actions.svelte";

/**
 * Slide-card keyboard map (§6.6): roving-tabstrip arrow/Home/End
 * navigation, Enter/Space activation (or multi-select toggle), Delete,
 * F2 rename. Pure wiring — the card component passes its live state in.
 */
export function handleSlideCardKeyDown(
  e: KeyboardEvent & { currentTarget: HTMLDivElement },
  args: {
    slideId: string;
    title: string;
    isRenaming: boolean;
    isMultiSelectMode: boolean;
    navigationIds: string[];
    cardRefs: Map<string, HTMLDivElement> | undefined;
    actions: SlideCardActions;
  },
): void {
  const { slideId, title, isRenaming, isMultiSelectMode, navigationIds, cardRefs, actions } = args;
  if (e.target !== e.currentTarget || isRenaming) return;

  if (isMultiSelectMode && (e.key === "Enter" || e.key === " ")) {
    e.preventDefault();
    e.stopPropagation();
    actions.toggleMultiSelect(slideId);
    return;
  }

  if (e.key === "ArrowRight" || e.key === "ArrowLeft" || e.key === "Home" || e.key === "End") {
    e.preventDefault();
    e.stopPropagation();
    if (!cardRefs || navigationIds.length === 0) return;
    const currentIndex = navigationIds.indexOf(slideId);
    const nextIndex =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? navigationIds.length - 1
          : (currentIndex + (e.key === "ArrowRight" ? 1 : -1) + navigationIds.length) %
            navigationIds.length;
    const next = cardRefs.get(navigationIds[nextIndex]);
    next?.focus();
    next?.scrollIntoView({ inline: "nearest", block: "nearest" });
    return;
  }

  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    e.stopPropagation();
    setCurrentSlideId(slideId);
    return;
  }

  if (e.key === "Delete" || e.key === "Backspace") {
    e.preventDefault();
    e.stopPropagation();
    actions.remove(slideId);
    return;
  }

  if (e.key === "F2") {
    e.preventDefault();
    e.stopPropagation();
    actions.startRename(slideId, title);
  }
}
