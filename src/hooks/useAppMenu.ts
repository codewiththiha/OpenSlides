/**
 * Subscribe to native menu events emitted from app-menu.ts.
 */
import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import type { AppMenuEvent } from "@/lib/app-menu";

type Handlers = Partial<Record<AppMenuEvent, () => void>>;

export function useAppMenu(handlers: Handlers) {
  useEffect(() => {
    const unsubs: Array<() => void> = [];
    const events: AppMenuEvent[] = [
      "menu://new-project",
      "menu://open-dashboard",
      "menu://export",
      "menu://present",
      "menu://zen",
      "menu://settings",
      "menu://command-palette",
      "menu://add-slide",
      "menu://toggle-theme",
      "menu://about",
      "menu://shortcuts",
    ];

    let cancelled = false;

    (async () => {
      for (const ev of events) {
        try {
          const un = await listen(ev, () => {
            handlers[ev]?.();
          });
          if (cancelled) un();
          else unsubs.push(un);
        } catch {
          /* not in tauri */
        }
      }
    })();

    return () => {
      cancelled = true;
      unsubs.forEach((u) => u());
    };
  }, [handlers]);
}
