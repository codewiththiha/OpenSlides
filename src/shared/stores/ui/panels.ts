/** Panel layout slice (§6.4). Values persist via ui-persistence. */
import { ui } from "./ui-object.svelte";

export function setIsBottomPanelCollapsed(v: boolean) {
  ui.isBottomPanelCollapsed = v;
}
export function setIsCodePanelCollapsed(v: boolean) {
  ui.isCodePanelCollapsed = v;
}
export function setCodePanelSize(v: number) {
  ui.codePanelSize = Math.min(70, Math.max(18, Math.round(v)));
}
export function setSlidesPanelSize(v: number) {
  ui.slidesPanelSize = Math.min(28, Math.max(14, Math.round(v)));
}
