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

  // If user exits OS fullscreen via Esc / system UI while presenting, sync off
  useEffect(() => {
    if (!isPresenting) return;
    const onFsChange = () => {
      if (!document.fullscreenElement) {
        const el = document.getElementById("openslides-present-root");
        if (el) {
          void (async () => {
            try {
              const win = getCurrentWindow();
              const nativeFs = await win.isFullscreen().catch(() => false);
              if (!nativeFs) setIsPresenting(false);
            } catch {
              setIsPresenting(false);
            }
          })();
        }
      }
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, [isPresenting, setIsPresenting]);

  return { enterPresent, exitPresent };
}
