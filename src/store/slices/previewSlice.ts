import type { StateCreator } from "zustand";
import type { UiState, PreviewProjectSettings, PreviewSlideSettings } from "../types";

export interface PreviewSlice {
  previewHighlightIndex: number;
  previewProject: PreviewProjectSettings;
  previewSlides: Map<string, PreviewSlideSettings>;
  previewHighlights: Map<string, Partial<import("@/types").Highlight>>;

  setPreviewHighlightIndex: (v: number) => void;
  setPreviewProjectSetting: <K extends keyof PreviewProjectSettings>(
    key: K,
    value: PreviewProjectSettings[K] | null,
  ) => void;
  setPreviewSlideSetting: <K extends keyof PreviewSlideSettings>(
    slideId: string,
    key: K,
    value: PreviewSlideSettings[K] | null,
  ) => void;
  setPreviewHighlightSetting: (
    highlightId: string,
    patch: Partial<import("@/types").Highlight>,
  ) => void;
  clearPreviewProjectSetting: (key: keyof PreviewProjectSettings) => void;
  clearPreviewSlideSetting: (
    slideId: string,
    key?: keyof PreviewSlideSettings,
  ) => void;
  clearPreviewHighlightSetting: (
    highlightId: string,
    key?: keyof import("@/types").Highlight,
  ) => void;
  clearAllPreviewSettings: () => void;
}

/**
 * Transient preview overrides use immutable Maps. Their references change on
 * every edit, allowing memoized preview consumers to react without separate
 * revision counters or in-place mutation.
 */
export const createPreviewSlice: StateCreator<UiState, [], [], PreviewSlice> = (set) => ({
  previewHighlightIndex: -1,
  previewProject: {},
  previewSlides: new Map(),
  previewHighlights: new Map(),

  setPreviewHighlightIndex: (v) => set({ previewHighlightIndex: v }),

  setPreviewProjectSetting: (key, value) =>
    set((s) => {
      if (value === null || value === undefined) {
        const next = { ...s.previewProject };
        delete (next as Record<string, unknown>)[key];
        return { previewProject: next };
      }
      return { previewProject: { ...s.previewProject, [key]: value } };
    }),

  setPreviewSlideSetting: (slideId, key, value) =>
    set((s) => {
      const next = new Map(s.previewSlides);
      const current = { ...(next.get(slideId) ?? {}) };
      if (value === null || value === undefined) delete current[key];
      else current[key] = value;

      if (Object.keys(current).length === 0) next.delete(slideId);
      else next.set(slideId, current);
      return { previewSlides: next };
    }),

  setPreviewHighlightSetting: (highlightId, patch) =>
    set((s) => {
      const next = new Map(s.previewHighlights);
      const current = { ...(next.get(highlightId) ?? {}) };
      for (const [key, value] of Object.entries(patch as Record<string, unknown>)) {
        if (value === null || value === undefined) delete current[key as keyof typeof current];
        else (current as Record<string, unknown>)[key] = value;
      }
      if (Object.keys(current).length === 0) next.delete(highlightId);
      else next.set(highlightId, current);
      return { previewHighlights: next };
    }),

  clearPreviewProjectSetting: (key) =>
    set((s) => {
      const next = { ...s.previewProject };
      delete (next as Record<string, unknown>)[key];
      return { previewProject: next };
    }),

  clearPreviewSlideSetting: (slideId, key) =>
    set((s) => {
      const next = new Map(s.previewSlides);
      if (!key) next.delete(slideId);
      else {
        const current = { ...(next.get(slideId) ?? {}) };
        delete current[key];
        if (Object.keys(current).length === 0) next.delete(slideId);
        else next.set(slideId, current);
      }
      return { previewSlides: next };
    }),

  clearPreviewHighlightSetting: (highlightId, key) =>
    set((s) => {
      const next = new Map(s.previewHighlights);
      if (!key) next.delete(highlightId);
      else {
        const current = { ...(next.get(highlightId) ?? {}) };
        delete current[key as keyof typeof current];
        if (Object.keys(current).length === 0) next.delete(highlightId);
        else next.set(highlightId, current);
      }
      return { previewHighlights: next };
    }),

  clearAllPreviewSettings: () =>
    set({
      previewProject: {},
      previewSlides: new Map(),
      previewHighlights: new Map(),
    }),
});
