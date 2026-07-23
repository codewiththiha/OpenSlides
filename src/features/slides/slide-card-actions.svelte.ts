import { getContext, setContext } from "svelte";
import type { Slide } from "$lib/types";

/**
 * Slide-strip card actions, shared via context (§2.1): the expanded strip
 * provides one stable API object and SlideCard consumers read it, instead of
 * every card receiving eleven callback props. Same pattern as the
 * dashboard's project-card-actions.
 *
 * Readonly fields are getter-backed, so consumers track the live rename
 * state without the context value itself being replaced.
 */
export type SlideCardActions = {
  readonly renamingId: string | null;
  readonly renameValue: string;
  setRenameValue: (value: string) => void;
  commitRename: () => void;
  cancelRename: () => void;
  startRename: (id: string, current: string) => void;
  remove: (id: string) => void;
  duplicate: (id: string) => void;
  registerCardRef: (id: string, node: HTMLDivElement | null) => void;
  toggleMultiSelect: (id: string, position?: { x: number; y: number }) => void;
  openContextMenu: (event: MouseEvent, slide: Slide, title: string) => void;
};

const KEY = Symbol("slide-card-actions");

export function provideSlideCardActions(actions: SlideCardActions): void {
  setContext(KEY, actions);
}

export function consumeSlideCardActions(): SlideCardActions {
  return getContext<SlideCardActions>(KEY);
}
