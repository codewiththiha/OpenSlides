/**
 * usePresentFullscreen — encapsulates fullscreen enter/exit + OS sync.
 */
import { ui, setIsAutoPlaying, setIsPresenting } from "$lib/stores/ui-state.svelte";
import { getCurrentWindow } from "@tauri-apps/api/window";

export function usePresentFullscreen() {
  async function exitPresent() {
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
  }

  async function tryEnterFullscreen() {
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
  }

  function enterPresent() {
    setIsPresenting(true);
  }

  // When overlay mounts, request true fullscreen after a tick
  $effect(() => {
    if (!ui.isPresenting) return;
    const t = window.setTimeout(() => {
      void tryEnterFullscreen();
    }, 50);
    return () => window.clearTimeout(t);
  });

  // If the user exits browser fullscreen or native Tauri fullscreen via Esc /
  // OS-level window controls, sync presentation state back to the UI. Native
  // fullscreen exits do not always emit `fullscreenchange`, so poll while the
  // presentation overlay is active as a small cross-platform safety net.
  $effect(() => {
    if (!ui.isPresenting) return;

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
  });

  return { enterPresent, exitPresent };
}
