/**
 * createCollapsiblePanel — shared expand/collapse choreography for the
 * paneforge rails (code panel + slides strip).
 *
 * Handles the four things every collapsible panel needs, identically:
 *   1. keep the imperative panel state in sync with the rune store
 *      (external collapse ←→ layout),
 *   2. `expand()` — restore the last persisted size on the next frame,
 *   3. `collapse()` — snapshot the current size first (so the chip can
 *      restore it later), then collapse,
 *   4. `onResize` — drag auto-collapse / drag-open lock choreography.
 */

export interface PaneHandle {
  collapse: () => void;
  expand: () => void;
  getSize: () => number;
  isCollapsed: () => boolean;
  isExpanded: () => boolean;
  resize: (size: number) => void;
  getId: () => string;
}

interface UseCollapsiblePanelArgs {
  panel: () => PaneHandle | null;
  isCollapsed: () => boolean;
  setCollapsed: (v: boolean) => void;
  /** Last persisted size (%) to restore on expand. */
  size: () => number;
  setSize: (v: number) => void;
  /** Sizes at/below this (% of group) are considered "already collapsed"
   *  and are not remembered as the restore target. */
  collapseThreshold: number;
}

export function createCollapsiblePanel({
  panel,
  isCollapsed,
  setCollapsed,
  size,
  setSize,
  collapseThreshold,
}: UseCollapsiblePanelArgs) {
  // Keep imperative panel collapse state in sync with the store.
  $effect(() => {
    const p = panel();
    if (!p) return;
    const collapsed = isCollapsed();
    try {
      if (collapsed) {
        if (!p.isCollapsed()) p.collapse();
      } else if (p.isCollapsed()) {
        // paneforge's expand() takes no size arg (react-resizable-panels'
        // expand(minSize) did) — expand, then resize to the persisted size.
        p.expand();
        p.resize(size());
      }
    } catch {
      /* ignore */
    }
  });

  function expand() {
    setCollapsed(false);
    requestAnimationFrame(() => {
      try {
        const p = panel();
        if (!p) return;
        p.expand();
        p.resize(size());
      } catch {
        /* ignore */
      }
    });
  }

  function collapse() {
    try {
      const current = panel()?.getSize();
      if (typeof current === "number" && current > collapseThreshold) {
        setSize(current);
      }
    } catch {
      /* ignore */
    }
    setCollapsed(true);
    try {
      panel()?.collapse();
    } catch {
      /* ignore */
    }
  }

  /* Native panel collapse owns snapping. This callback only remembers usable
   * expanded sizes; it does not issue another collapse or expand request. */
  function onResize(nextSize: number) {
    if (nextSize >= collapseThreshold) setSize(nextSize);
  }

  return { expand, collapse, onResize };
}
