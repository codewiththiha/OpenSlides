/**
 * The single UI state object (Svelte 5 runes).
 *
 * Fine-grained dependencies keep updates surgical: reading
 * `ui.currentSlideId` in a component tracks that one property, so no
 * selector layer is needed anywhere.
 *
 * Panel layout prefs persist across restarts via localStorage
 * ({ state, version } wire format); preview overrides stay transient for
 * instant slider feedback. Setters live in the sibling slice modules —
 * mutate ui only through them (§7.2).
 */
import { SvelteMap } from "svelte/reactivity";
import type { Highlight } from "$lib/types";
import { applyUiTheme } from "../theme";
import {
  loadPersistedUiState,
  savePersistedUiState,
  DEFAULT_CODE_SIZE,
  DEFAULT_SLIDES_SIZE,
} from "../ui-persistence";
import type {
  PreviewProjectSettings,
  PreviewSlideSettings,
  SaveStatus,
} from "../types";

const persisted = loadPersistedUiState();

export const ui = $state({
  currentSlideId: null as string | null,
  isPresenting: false,
  isAutoPlaying: false,
  isZenMode: false,
  isBottomPanelCollapsed: persisted.isBottomPanelCollapsed ?? false,
  isCodePanelCollapsed: persisted.isCodePanelCollapsed ?? false,
  codePanelSize: persisted.codePanelSize ?? DEFAULT_CODE_SIZE,
  slidesPanelSize: persisted.slidesPanelSize ?? DEFAULT_SLIDES_SIZE,
  isSettingsOpen: false,
  isCommandOpen: false,
  isGoToSlideOpen: false,
  isShortcutsOpen: false,
  isDarkUi: persisted.isDarkUi ?? true,
  editorShowLineNumbers: persisted.editorShowLineNumbers ?? true,
  showSlideHoverPreview: persisted.showSlideHoverPreview ?? false,
  saveStatus: "idle" as SaveStatus,
  previewHighlightIndex: -1,
  previewProject: {} as PreviewProjectSettings,
  previewSlides: new SvelteMap<string, PreviewSlideSettings>(),
  previewHighlights: new SvelteMap<string, Partial<Highlight>>(),
});

// Re-apply the hydrated theme to <html> on startup.
applyUiTheme(ui.isDarkUi);

/** Persisted slice — written on every change (partialize-equivalent). */
$effect.root(() => {
  $effect(() => {
    savePersistedUiState({
      isBottomPanelCollapsed: ui.isBottomPanelCollapsed,
      isCodePanelCollapsed: ui.isCodePanelCollapsed,
      codePanelSize: ui.codePanelSize,
      slidesPanelSize: ui.slidesPanelSize,
      isDarkUi: ui.isDarkUi,
      editorShowLineNumbers: ui.editorShowLineNumbers,
      showSlideHoverPreview: ui.showSlideHoverPreview,
    });
  });
});
