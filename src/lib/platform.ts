/** Lightweight platform helpers (no extra plugin required). */

export type AppPlatform = "macos" | "windows" | "linux" | "unknown";

export function detectPlatform(): AppPlatform {
  const ua = navigator.userAgent.toLowerCase();
  const plat = (navigator.platform || "").toLowerCase();

  if (plat.includes("mac") || ua.includes("mac os")) return "macos";
  if (plat.includes("win") || ua.includes("windows")) return "windows";
  if (plat.includes("linux") || ua.includes("linux")) return "linux";
  return "unknown";
}

export const isMacOS = () => detectPlatform() === "macos";
export const isWindows = () => detectPlatform() === "windows";

/** Modifier label for UI hints. */
export function modKeyLabel(): string {
  return isMacOS() ? "⌘" : "Ctrl";
}
