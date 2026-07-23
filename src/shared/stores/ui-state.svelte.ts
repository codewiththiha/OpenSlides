/**
 * UI state (Svelte 5 runes).
 *
 * Fine-grained dependencies keep updates surgical: reading
 * `ui.currentSlideId` in a component tracks that one property, so no
 * selector layer is needed anywhere.
 *
 * Panel layout prefs persist across restarts via localStorage
 * ({ state, version } wire format); preview overrides stay transient for
 * instant slider feedback.
 */
import { SvelteMap } from "svelte/reactivity";
import type { Highlight } from "$lib/types";
import { applyUiTheme } from "./theme";
import {
  loadPersistedUiState,
  savePersistedUiState,
  DEFAULT_CODE_SIZE,
  DEFAULT_SLIDES_SIZE,
} from "./ui-persistence";
import { clearAllLocalCode } from "./slide-code.svelte";
import { clearCaretPositions } from "./caret-positions";
import type {
  PreviewProjectSettings,
  PreviewSlideSettings,
  SaveStatus,
} from "./types";

export type {
  PreviewProjectSettings,
  PreviewSlideSettings,
  SaveStatus,
} from "./types";
export { applyUiTheme } from "./theme";

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

/* ------------------------------------------------------------------ */
/* Presentation slice                                                  */
/* ------------------------------------------------------------------ */
export function setCurrentSlideId(id: string | null) {
  ui.currentSlideId = id;
}
export function setIsPresenting(v: boolean) {
  ui.isPresenting = v;
}
export function setIsAutoPlaying(v: boolean) {
  ui.isAutoPlaying = v;
}
export function toggleAutoPlaying() {
  ui.isAutoPlaying = !ui.isAutoPlaying;
}

/* ------------------------------------------------------------------ */
/* Panel slice                                                         */
/* ------------------------------------------------------------------ */
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

/* ------------------------------------------------------------------ */
/* Dialog slice                                                        */
/* ------------------------------------------------------------------ */
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

/* ------------------------------------------------------------------ */
/* Prefs slice                                                         */
/* ------------------------------------------------------------------ */
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

/* ------------------------------------------------------------------ */
/* Preview slice (transient overrides)                                 */
/* ------------------------------------------------------------------ */
export function setPreviewHighlightIndex(v: number) {
  ui.previewHighlightIndex = v;
}

export function setPreviewProjectSetting<K extends keyof PreviewProjectSettings>(
  key: K,
  value: PreviewProjectSettings[K] | null,
) {
  if (value === null || value === undefined) {
    delete ui.previewProject[key];
  } else {
    ui.previewProject[key] = value;
  }
}

export function setPreviewSlideSetting<K extends keyof PreviewSlideSettings>(
  slideId: string,
  key: K,
  value: PreviewSlideSettings[K] | null,
) {
  const current = { ...(ui.previewSlides.get(slideId) ?? {}) };
  if (value === null || value === undefined) delete current[key];
  else current[key] = value;

  if (Object.keys(current).length === 0) ui.previewSlides.delete(slideId);
  else ui.previewSlides.set(slideId, current);
}

export function setPreviewHighlightSetting(
  highlightId: string,
  patch: Partial<Highlight>,
) {
  const current = { ...(ui.previewHighlights.get(highlightId) ?? {}) };
  for (const [key, value] of Object.entries(patch as Record<string, unknown>)) {
    if (value === null || value === undefined) {
      delete current[key as keyof typeof current];
    } else {
      (current as Record<string, unknown>)[key] = value;
    }
  }
  if (Object.keys(current).length === 0) ui.previewHighlights.delete(highlightId);
  else ui.previewHighlights.set(highlightId, current);
}

export function clearPreviewProjectSetting(key: keyof PreviewProjectSettings) {
  delete ui.previewProject[key];
}

export function clearPreviewSlideSetting(
  slideId: string,
  key?: keyof PreviewSlideSettings,
) {
  if (!key) {
    ui.previewSlides.delete(slideId);
    return;
  }
  const current = { ...(ui.previewSlides.get(slideId) ?? {}) };
  delete current[key];
  if (Object.keys(current).length === 0) ui.previewSlides.delete(slideId);
  else ui.previewSlides.set(slideId, current);
}

export function clearPreviewHighlightSetting(
  highlightId: string,
  key?: keyof Highlight,
) {
  if (!key) {
    ui.previewHighlights.delete(highlightId);
    return;
  }
  const current = { ...(ui.previewHighlights.get(highlightId) ?? {}) };
  delete current[key as keyof typeof current];
  if (Object.keys(current).length === 0) ui.previewHighlights.delete(highlightId);
  else ui.previewHighlights.set(highlightId, current);
}

export function clearAllPreviewSettings() {
  ui.previewProject = {};
  ui.previewSlides = new SvelteMap();
  ui.previewHighlights = new SvelteMap();
}

/* ------------------------------------------------------------------ */
/* Cross-cutting actions                                               */
/* ------------------------------------------------------------------ */
export { clearLocalCode } from "./slide-code.svelte";

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
