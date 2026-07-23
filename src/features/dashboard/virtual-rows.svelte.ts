/**
 * Responsive column count + @tanstack/svelte-virtual row window for the
 * project grid's scroll container. Owned here so ProjectGrid.svelte stays
 * rendering-focused.
 */
import { createVirtualizer } from "@tanstack/svelte-virtual";
import { get } from "svelte/store";

export function createProjectRowVirtualizer(args: { rowCount: () => number }) {
  /* Responsive columns (1/2/3 by window width). */
  let columnCount = $state(3);
  $effect(() => {
    const update = () =>
      (columnCount = window.innerWidth < 768 ? 1 : window.innerWidth < 1024 ? 2 : 3);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  });

  let parentEl = $state<HTMLDivElement | null>(null);

  const rowVirtualizer = createVirtualizer<HTMLDivElement, HTMLDivElement>({
    count: 0,
    getScrollElement: () => parentEl,
    estimateSize: () => 220,
    overscan: 5,
    measureElement: (el) => el.getBoundingClientRect().height,
  });

  $effect(() => {
    const count = args.rowCount();
    // The instance is read NON-reactively (get(), not $rowVirtualizer):
    // svelte-virtual's setOptions always ends with a store.set() that marks
    // subscribers dirty (objects are never "equal"), so a tracked read here
    // would re-trigger this very effect forever — Svelte's
    // effect_update_depth_exceeded guard fired and the dashboard froze.
    get(rowVirtualizer).setOptions({
      count,
      getScrollElement: () => parentEl,
      estimateSize: () => 220,
      overscan: 5,
      measureElement: (el: HTMLElement) => el.getBoundingClientRect().height,
    });
  });

  /** Row-height measurement as a Svelte action (`use:...`). */
  function measureRow(node: HTMLDivElement) {
    get(rowVirtualizer).measureElement(node);
  }

  // The store itself is returned so the component's $-prefix
  // auto-subscription can track virtual rows / total size.
  return {
    get columnCount() {
      return columnCount;
    },
    get parentEl() {
      return parentEl;
    },
    set parentEl(el: HTMLDivElement | null) {
      parentEl = el;
    },
    rowVirtualizer,
    measureRow,
  };
}
