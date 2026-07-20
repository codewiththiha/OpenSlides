import { useUiStore } from "@/store/useUiStore";
import type {
  PreviewProjectSettings,
  PreviewSlideSettings,
} from "@/store/useUiStore";
import type { Highlight } from "@/types";

export function usePreviewProjectSetting<K extends keyof PreviewProjectSettings>(
  key: K,
): PreviewProjectSettings[K] | undefined {
  return useUiStore((s) => s.previewProject[key]);
}

export function usePreviewSlideSetting<K extends keyof PreviewSlideSettings>(
  slideId: string | undefined,
  key: K,
): PreviewSlideSettings[K] | undefined {
  useUiStore((s) => s.previewSlidesRevision);
  if (!slideId) return undefined;
  return useUiStore.getState().previewSlides.get(slideId)?.[key];
}

export function usePreviewHighlightSetting<K extends keyof Highlight>(
  highlightId: string,
  key: K,
): Highlight[K] | undefined {
  useUiStore((s) => s.previewHighlightsRevision);
  return useUiStore.getState().previewHighlights.get(highlightId)?.[key];
}

export function usePreviewSlidesMap() {
  useUiStore((s) => s.previewSlidesRevision);
  return useUiStore.getState().previewSlides;
}

export function usePreviewHighlightsMap() {
  useUiStore((s) => s.previewHighlightsRevision);
  return useUiStore.getState().previewHighlights;
}
