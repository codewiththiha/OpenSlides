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
  return useUiStore((s) => slideId ? s.previewSlides.get(slideId)?.[key] : undefined);
}

export function usePreviewHighlightSetting<K extends keyof Highlight>(
  highlightId: string,
  key: K,
): Highlight[K] | undefined {
  return useUiStore((s) => s.previewHighlights.get(highlightId)?.[key]);
}

export function usePreviewSlidesMap() {
  return useUiStore((s) => s.previewSlides);
}

export function usePreviewHighlightsMap() {
  return useUiStore((s) => s.previewHighlights);
}
