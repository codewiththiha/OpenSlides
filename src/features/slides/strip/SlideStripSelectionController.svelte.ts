/**
 * Slide-strip multi-selection state + batch actions (move, group, bulk
 * delete). The context-menu controller is the entry point, so this
 * controller both reads and updates it.
 */
import { SvelteSet } from "svelte/reactivity";
import type { Slide } from "$lib/types";

interface DeleterLike {
  deleteSlides(ids: string[]): Promise<{ ok: boolean; deletedIds: Set<string> }>;
}

interface MenuLike {
  menu: { slide: Slide; title: string; position: { x: number; y: number } } | null;
  close: () => void;
  updatePosition: (position: { x: number; y: number }) => void;
}

export function createSlideStripSelection(args: {
  ordered: () => Slide[];
  menuCtl: () => MenuLike;
  reorderSlides: (ids: string[]) => void;
  stackSlides: (
    sourceIds: string[],
    targetId: string,
    opts?: { onSuccess?: () => void },
  ) => void;
  deleter: DeleterLike;
}) {
  const selectedSlideIds = new SvelteSet<string>();
  let isMultiSelectMode = $state(false);
  let confirmBulkDelete = $state(false);

  // Reserve the bottom-right toast slot for the batch-action bubbles. The
  // toaster moves above it only while a multi-selection is active.
  $effect(() => {
    const root = document.documentElement;
    root.toggleAttribute("data-slide-selection-active", isMultiSelectMode);
    return () => root.removeAttribute("data-slide-selection-active");
  });

  const selectedInOrder = () =>
    args
      .ordered()
      .filter((slide) => selectedSlideIds.has(slide.id))
      .map((slide) => slide.id);

  function toggleSlideSelection(id: string, position?: { x: number; y: number }) {
    if (selectedSlideIds.has(id)) selectedSlideIds.delete(id);
    else selectedSlideIds.add(id);
    if (position && args.menuCtl().menu) {
      args.menuCtl().updatePosition(position);
    }
  }

  function startMultiSelect() {
    const menu = args.menuCtl().menu;
    if (!menu) return;
    isMultiSelectMode = true;
    selectedSlideIds.clear();
    selectedSlideIds.add(menu.slide.id);
    args.menuCtl().close();
  }

  function selectAllSlides() {
    isMultiSelectMode = true;
    selectedSlideIds.clear();
    for (const slide of args.ordered()) selectedSlideIds.add(slide.id);
    args.menuCtl().close();
  }

  function clearSlideSelection() {
    selectedSlideIds.clear();
    isMultiSelectMode = false;
    args.menuCtl().close();
  }

  function moveSelected(destination: "start" | "end") {
    const selected = selectedInOrder();
    if (!selected.length) return;
    const selectedSet = new Set(selected);
    const remaining = args
      .ordered()
      .filter((slide) => !selectedSet.has(slide.id))
      .map((slide) => slide.id);
    args.reorderSlides(
      destination === "start" ? [...selected, ...remaining] : [...remaining, ...selected],
    );
    args.menuCtl().close();
  }

  function groupSelected() {
    const selected = selectedInOrder();
    if (selected.length < 2) return;
    args.stackSlides(selected.slice(1), selected[0], {
      onSuccess: () => {
        selectedSlideIds.clear();
        for (const id of selected) selectedSlideIds.add(id);
      },
    });
    args.menuCtl().close();
  }

  function deleteSelected() {
    const selected = selectedInOrder();
    if (!selected.length || selected.length >= args.ordered().length) return;
    confirmBulkDelete = true;
    args.menuCtl().close();
  }

  function confirmDeleteSelected() {
    const selected = selectedInOrder();
    confirmBulkDelete = false;
    void (async () => {
      const result = await args.deleter.deleteSlides(selected);
      if (result.ok) {
        selectedSlideIds.clear();
        isMultiSelectMode = false;
        return;
      }
      // Keep any slides that were not deleted selected so the user can retry
      // or choose another bulk action without losing context.
      for (const id of [...selectedSlideIds]) {
        if (result.deletedIds.has(id)) selectedSlideIds.delete(id);
      }
    })();
  }

  return {
    selectedSlideIds,
    get isMultiSelectMode() {
      return isMultiSelectMode;
    },
    get confirmBulkDelete() {
      return confirmBulkDelete;
    },
    set confirmBulkDelete(v: boolean) {
      confirmBulkDelete = v;
    },
    selectedInOrder,
    toggleSlideSelection,
    startMultiSelect,
    selectAllSlides,
    clearSlideSelection,
    moveSelected,
    groupSelected,
    deleteSelected,
    confirmDeleteSelected,
  };
}
