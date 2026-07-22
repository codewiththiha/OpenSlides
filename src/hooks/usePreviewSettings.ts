import { useMemo } from "react";
import { useUiStore } from "@/store/useUiStore";
import type {
  PreviewProjectSettings,
  PreviewSlideSettings,
} from "@/store/useUiStore";
import type { Highlight } from "@/types";

export function usePreviewProjectSettings(): PreviewProjectSettings {
  return useUiStore((s) => s.previewProject);
}

export function usePreviewProjectSetting<K extends keyof PreviewProjectSettings>(
  key: K,
): PreviewProjectSettings[K] | undefined {
  return useUiStore((s) => s.previewProject[key]);
}

export function usePreviewSlideSettings(
  slideId: string | undefined,
): PreviewSlideSettings | undefined {
  return useUiStore((s) => slideId ? s.previewSlides.get(slideId) : undefined);
}

export function usePreviewSlideSetting<K extends keyof PreviewSlideSettings>(
  slideId: string | undefined,
  key: K,
): PreviewSlideSettings[K] | undefined {
  return useUiStore((s) => slideId ? s.previewSlides.get(slideId)?.[key] : undefined);
}

export function usePreviewHighlightSettings(
  highlightId: string | undefined,
): Partial<Highlight> | undefined {
  return useUiStore((s) => highlightId ? s.previewHighlights.get(highlightId) : undefined);
}

export function usePreviewHighlightSetting<K extends keyof Highlight>(
  highlightId: string,
  key: K,
): Highlight[K] | undefined {
  return useUiStore((s) => s.previewHighlights.get(highlightId)?.[key]);
}

export function usePreviewMergedHighlights<T extends Highlight>(highlights: readonly T[]): T[] {
  const previewHighlights = useUiStore((s) => s.previewHighlights);
  return useMemo(
    () =>
      highlights.map((highlight) => {
        const preview = previewHighlights.get(highlight.id);
        return preview ? { ...highlight, ...preview } : highlight;
      }),
    [highlights, previewHighlights],
  );
}

/** Prefer usePreviewSlideSettings/usePreviewMergedHighlights for component code. */
export function usePreviewSlidesMap() {
  return useUiStore((s) => s.previewSlides);
}

/** Prefer usePreviewHighlightSettings/usePreviewMergedHighlights for component code. */
export function usePreviewHighlightsMap() {
  return useUiStore((s) => s.previewHighlights);
}
