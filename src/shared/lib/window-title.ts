/**
 * Sync the document title and the native (Tauri) window title in one place.
 */
import { getCurrentWindow } from "@tauri-apps/api/window";
import { logger } from "./logger";

export function setWindowTitle(title: string): void {
  document.title = title;
  getCurrentWindow()
    .setTitle(title)
    .catch((error) => logger.debug("Failed to set native window title", error));
}
