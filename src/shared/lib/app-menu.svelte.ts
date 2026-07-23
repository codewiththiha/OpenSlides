/**
 * Subscribe to native menu events emitted from app-menu.ts.
 */
import { listen } from "@tauri-apps/api/event";
import type { AppMenuEvent } from "$lib/lib/app-menu";

export type AppMenuHandlers = Partial<Record<AppMenuEvent, () => void>>;

export function subscribeToAppMenu(handlers: () => AppMenuHandlers) {
  $effect(() => {
    const unsubs: Array<() => void> = [];
    // Snapshot the handler map for this subscription round — listeners read
    // through it so replacements only take effect on resubscribe.
    const current = handlers();
    const events = Object.keys(current) as AppMenuEvent[];

    let cancelled = false;

    (async () => {
      for (const ev of events) {
        try {
          const un = await listen(ev, () => {
            current[ev]?.();
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
  });
}
