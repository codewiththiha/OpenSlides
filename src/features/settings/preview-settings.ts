/**
 * Preview-override helpers — plain functions over the rune store.
 * Consume them inside `$derived(...)` at component level for reactivity:
 *
 *   const fontSize = $derived(previewProjectSetting("fontSize") ?? project.settings.fontSize);
 */
import { ui } from "$lib/stores/ui-state.svelte";
import type {
  PreviewProjectSettings,
  PreviewSlideSettings,
} from "$lib/stores/types";
import type { Highlight } from "$lib/types";

export function previewProjectSettings(): PreviewProjectSettings {
  return ui.previewProject;
}

export function previewProjectSetting<K extends keyof PreviewProjectSettings>(
  key: K,
): PreviewProjectSettings[K] | undefined {
  return ui.previewProject[key];
}

export function previewSlideSettings(
  slideId: string | undefined,
): PreviewSlideSettings | undefined {
  return slideId ? ui.previewSlides.get(slideId) : undefined;
}

export function previewHighlightSettings(
  highlightId: string | undefined,
): Partial<Highlight> | undefined {
  return highlightId ? ui.previewHighlights.get(highlightId) : undefined;
}

export function previewMergedHighlights<T extends Highlight>(
  highlights: readonly T[],
): T[] {
  return highlights.map((highlight) => {
    const preview = ui.previewHighlights.get(highlight.id);
    return preview ? { ...highlight, ...preview } : highlight;
  });
}
