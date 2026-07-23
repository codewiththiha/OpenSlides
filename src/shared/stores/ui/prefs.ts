/** Editor/app preferences slice (§6.4). */
import { ui } from "./ui-object.svelte";
import { applyUiTheme } from "../theme";
import type { SaveStatus } from "../types";

export function toggleZenMode() {
  ui.isZenMode = !ui.isZenMode;
}
export function toggleTheme() {
  ui.isDarkUi = !ui.isDarkUi;
  applyUiTheme(ui.isDarkUi);
}
export function setEditorShowLineNumbers(v: boolean) {
  ui.editorShowLineNumbers = v;
}
export function setShowSlideHoverPreview(v: boolean) {
  ui.showSlideHoverPreview = v;
}
export function setSaveStatus(s: SaveStatus) {
  ui.saveStatus = s;
}
