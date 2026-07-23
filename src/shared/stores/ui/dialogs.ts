/** Dialog visibility slice (§6.4). */
import { ui } from "./ui-object.svelte";

export function setIsGoToSlideOpen(v: boolean) {
  ui.isGoToSlideOpen = v;
}
export function setIsSettingsOpen(v: boolean) {
  ui.isSettingsOpen = v;
}
export function setIsCommandOpen(v: boolean) {
  ui.isCommandOpen = v;
}
export function setIsShortcutsOpen(v: boolean) {
  ui.isShortcutsOpen = v;
}
export function toggleShortcutsOpen() {
  ui.isShortcutsOpen = !ui.isShortcutsOpen;
}
