/** Cross-cutting editor reset (§6.4): leaving a project clears its UI. */
import { SvelteMap } from "svelte/reactivity";
import { ui } from "./ui-object.svelte";
import { clearAllLocalCode } from "../slide-code.svelte";
import { clearCaretPositions } from "../caret-positions";

export function resetEditorUi() {
  clearAllLocalCode();
  clearCaretPositions();
  ui.currentSlideId = null;
  ui.isPresenting = false;
  ui.isAutoPlaying = false;
  ui.isZenMode = false;
  ui.isSettingsOpen = false;
  ui.isGoToSlideOpen = false;
  ui.isShortcutsOpen = false;
  ui.saveStatus = "idle";
  ui.previewHighlightIndex = -1;
  ui.previewProject = {};
  ui.previewSlides = new SvelteMap();
  ui.previewHighlights = new SvelteMap();
}
