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
import { useCallback, useEffect, useRef, type RefObject } from "react";
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

  /* ---- drag auto-collapse (Panel onResize) ----
   * The panel's layout engine can call onResize between renders (mid-drag),
   * so the handler must not trust render-scoped `isCollapsed` — mirror it.
   * A short async lock after each auto-transition breaks the feedback loop
   * the collapse→resize→collapse hand-off would otherwise create. */
  const collapsedRef = useRef(isCollapsed);
  useEffect(() => {
    collapsedRef.current = isCollapsed;
  }, [isCollapsed]);

  const resizeLock = useRef(false);
  const lockTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(lockTimer.current), []);

  const onResize = useCallback(
    (size: number) => {
      if (resizeLock.current) return;
      const collapsed = collapsedRef.current;

      // Drag-open from the collapsed rail
      if (collapsed && size > collapseThreshold) {
        resizeLock.current = true;
        setCollapsed(false);
        setSize(size);
        lockTimer.current = window.setTimeout(() => {
          resizeLock.current = false;
        }, 150);
        return;
      }

      if (!collapsed && size >= collapseThreshold) {
        setSize(size);
        return;
      }

      if (!collapsed && size < collapseThreshold) {
        resizeLock.current = true;
        setCollapsed(true);
        try {
          panelRef.current?.collapse();
        } catch {
          /* ignore */
        }
        lockTimer.current = window.setTimeout(() => {
          resizeLock.current = false;
        }, 200);
      }
    },
    [panelRef, collapseThreshold, setCollapsed, setSize],
  );

  return { expand, collapse, onResize };
}
