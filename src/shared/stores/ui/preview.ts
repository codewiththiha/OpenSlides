/**
 * Preview slice (§6.4) — transient setting overrides that drive instant
 * slider feedback in the settings UI without touching persisted data.
 */
import { SvelteMap } from "svelte/reactivity";
import type { Highlight } from "$lib/types";
import { ui } from "./ui-object.svelte";
import type { PreviewProjectSettings, PreviewSlideSettings } from "../types";

export function setPreviewHighlightIndex(v: number) {
  ui.previewHighlightIndex = v;
}

export function setPreviewProjectSetting<
  K extends keyof PreviewProjectSettings,
>(key: K, value: PreviewProjectSettings[K] | null) {
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
  if (Object.keys(current).length === 0)
    ui.previewHighlights.delete(highlightId);
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
  if (Object.keys(current).length === 0)
    ui.previewHighlights.delete(highlightId);
  else ui.previewHighlights.set(highlightId, current);
}

export function clearAllPreviewSettings() {
  ui.previewProject = {};
  ui.previewSlides = new SvelteMap();
  ui.previewHighlights = new SvelteMap();
}
