/**
 * useCollapsiblePanel — shared expand/collapse choreography for the
 * react-resizable-panels rails (code panel + slides strip).
 *
 * Handles the four things every collapsible panel needs, identically:
 *   1. keep the imperative panel state in sync with the Zustand store
 *      (external collapse ←→ layout),
 *   2. `expand()` — restore the last persisted size on the next frame,
 *   3. `collapse()` — snapshot the current size first (so the chip can
 *      restore it later), then collapse,
 *   4. `onResize` — drag auto-collapse / drag-open lock choreography
 *      (byte-identical in both rails before this hook existed).
 */
import { useCallback, useEffect, type RefObject } from "react";
import type { ImperativePanelHandle } from "react-resizable-panels";

interface UseCollapsiblePanelArgs {
  panelRef: RefObject<ImperativePanelHandle | null>;
  isCollapsed: boolean;
  setCollapsed: (v: boolean) => void;
  /** Last persisted size (%) to restore on expand. */
  size: number;
  setSize: (v: number) => void;
  /** Sizes at/below this (% of group) are considered "already collapsed"
   *  and are not remembered as the restore target. */
  collapseThreshold: number;
}

export function useCollapsiblePanel({
  panelRef,
  isCollapsed,
  setCollapsed,
  size,
  setSize,
  collapseThreshold,
}: UseCollapsiblePanelArgs) {
  // Keep imperative panel collapse state in sync with the store.
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    try {
      if (isCollapsed) {
        if (!panel.isCollapsed()) panel.collapse();
      } else if (panel.isCollapsed()) {
        panel.expand(size);
      }
    } catch {
      /* ignore */
    }
  }, [panelRef, isCollapsed, size]);

  const expand = useCallback(() => {
    setCollapsed(false);
    requestAnimationFrame(() => {
      try {
        const panel = panelRef.current;
        if (!panel) return;
        panel.expand(size);
        panel.resize(size);
      } catch {
        /* ignore */
      }
    });
  }, [panelRef, size, setCollapsed]);

  const collapse = useCallback(() => {
    try {
      const current = panelRef.current?.getSize();
      if (typeof current === "number" && current > collapseThreshold) {
        setSize(current);
      }
    } catch {
      /* ignore */
    }
    setCollapsed(true);
    try {
      panelRef.current?.collapse();
    } catch {
      /* ignore */
    }
  }, [panelRef, collapseThreshold, setSize, setCollapsed]);

  /* Native panel collapse owns snapping. This callback only remembers usable
   * expanded sizes; it does not issue another collapse or expand request. */
  const onResize = useCallback(
    (size: number) => {
      if (size >= collapseThreshold) setSize(size);
    },
    [collapseThreshold, setSize],
  );

  return { expand, collapse, onResize };
}
