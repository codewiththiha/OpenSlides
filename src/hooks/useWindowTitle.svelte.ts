import { getCurrentWindow } from "@tauri-apps/api/window";

/** Sync document + native window title (reactive). */
export function useWindowTitle(title: () => string) {
  $effect(() => {
    const t = title();
    document.title = t;
    getCurrentWindow().setTitle(t).catch(() => undefined);
  });
}
