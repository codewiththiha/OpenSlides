/**
 * Subscribe to native menu events emitted from app-menu.ts.
 */
import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { toast } from "sonner";
import type { AppMenuEvent } from "@/lib/app-menu";

type Handlers = Partial<Record<AppMenuEvent | "menu://about", () => void>>;

export function useAppMenu(handlers: Handlers) {
  useEffect(() => {
    const unsubs: Array<() => void> = [];
    const events: Array<AppMenuEvent | "menu://about"> = [
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
    ];

    let cancelled = false;

    (async () => {
      for (const ev of events) {
        try {
          const un = await listen(ev, () => {
            if (ev === "menu://about" && !handlers[ev]) {
              toast.message("OpenSlides", {
                description: "Offline-first code presentations · Tauri + Rust + SQLite",
              });
              return;
            }
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
    // handlers intentionally re-bound when identity changes
  }, [handlers]);
}
