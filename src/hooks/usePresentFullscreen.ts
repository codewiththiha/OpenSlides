/**
 * usePresentFullscreen — encapsulates fullscreen enter/exit + OS sync.
 *
 * Previously part of God component Editor.tsx. Now a focused hook with
 * minimal deps: only isPresenting from store + stable setIsPresenting.
 */
import { useCallback, useEffect } from "react";
import { useUiStore } from "@/store/useUiStore";
import { getCurrentWindow } from "@tauri-apps/api/window";

export function usePresentFullscreen() {
  const isPresenting = useUiStore((s) => s.isPresenting);
  const setIsPresenting = useUiStore((s) => s.setIsPresenting);
  const setIsAutoPlaying = useUiStore((s) => s.setIsAutoPlaying);

  const exitPresent = useCallback(async () => {
    setIsPresenting(false);
    setIsAutoPlaying(false);
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {
      /* ignore */
    }
    try {
      const win = getCurrentWindow();
      if (await win.isFullscreen()) {
        await win.setFullscreen(false);
      }
    } catch {
      /* ignore */
    }
  }, [setIsPresenting, setIsAutoPlaying]);

  const tryEnterFullscreen = useCallback(async () => {
    const el = document.getElementById("openslides-present-root");
    try {
      if (el && el.requestFullscreen && !document.fullscreenElement) {
        await el.requestFullscreen();
        return;
      }
    } catch {
      /* fall through */
    }
    try {
      const win = getCurrentWindow();
      if (!(await win.isFullscreen())) {
        await win.setFullscreen(true);
      }
    } catch {
      /* overlay still works windowed */
    }
  }, []);

  const enterPresent = useCallback(() => {
    setIsPresenting(true);
  }, [setIsPresenting]);

  // When overlay mounts, request true fullscreen after a tick
  useEffect(() => {
    if (!isPresenting) return;
    const t = window.setTimeout(() => {
      void tryEnterFullscreen();
    }, 50);
    return () => window.clearTimeout(t);
  }, [isPresenting, tryEnterFullscreen]);

  // If the user exits browser fullscreen or native Tauri fullscreen via Esc /
  // OS-level window controls, sync presentation state back to the UI. Native
  // fullscreen exits do not always emit `fullscreenchange`, so poll while the
  // presentation overlay is active as a small cross-platform safety net.
  useEffect(() => {
    if (!isPresenting) return;

    const syncFullscreenState = () => {
      const el = document.getElementById("openslides-present-root");
      if (!el || document.fullscreenElement) return;
      void (async () => {
        try {
          const win = getCurrentWindow();
          const nativeFs = await win.isFullscreen().catch(() => false);
          if (!nativeFs) {
            setIsPresenting(false);
            setIsAutoPlaying(false);
          }
        } catch {
          setIsPresenting(false);
          setIsAutoPlaying(false);
        }
      })();
    };

    document.addEventListener("fullscreenchange", syncFullscreenState);
    const interval = window.setInterval(syncFullscreenState, 750);
    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreenState);
      window.clearInterval(interval);
    };
  }, [isPresenting, setIsPresenting, setIsAutoPlaying]);

  return { enterPresent, exitPresent };
}
