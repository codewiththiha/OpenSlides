import type { StateCreator } from "zustand";
import type { UiState, PreviewProjectSettings, PreviewSlideSettings } from "../types";

export interface PreviewSlice {
  previewHighlightIndex: number;
  previewProject: PreviewProjectSettings;
  previewSlides: Map<string, PreviewSlideSettings>;
  previewHighlights: Map<string, Partial<import("@/types").Highlight>>;
  previewSlidesRevision: number;
  previewHighlightsRevision: number;

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

export const createPreviewSlice: StateCreator<UiState, [], [], PreviewSlice> = (set) => ({
  previewHighlightIndex: -1,
  previewProject: {},
  previewSlides: new Map(),
  previewHighlights: new Map(),
  previewSlidesRevision: 0,
  previewHighlightsRevision: 0,

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
      const current = s.previewSlides.get(slideId) ?? {};
      if (value === null || value === undefined) {
        if (!(key in current)) return s;
        delete current[key];
        if (Object.keys(current).length === 0) s.previewSlides.delete(slideId);
      } else {
        current[key] = value;
        s.previewSlides.set(slideId, current);
      }
      return { previewSlidesRevision: s.previewSlidesRevision + 1 };
    }),

  setPreviewHighlightSetting: (highlightId, patch) =>
    set((s) => {
      const current = s.previewHighlights.get(highlightId) ?? {};
      for (const [key, value] of Object.entries(patch as Record<string, unknown>)) {
        if (value === null || value === undefined) delete current[key as keyof typeof current];
        else (current as Record<string, unknown>)[key] = value;
      }
      if (Object.keys(current).length === 0) s.previewHighlights.delete(highlightId);
      else s.previewHighlights.set(highlightId, current);
      return { previewHighlightsRevision: s.previewHighlightsRevision + 1 };
    }),

  clearPreviewProjectSetting: (key) =>
    set((s) => {
      const next = { ...s.previewProject };
      delete (next as Record<string, unknown>)[key];
      return { previewProject: next };
    }),

  clearPreviewSlideSetting: (slideId, key) =>
    set((s) => {
      if (key) {
        const current = s.previewSlides.get(slideId);
        if (!current) return s;
        delete current[key];
        if (Object.keys(current).length === 0) s.previewSlides.delete(slideId);
      } else {
        s.previewSlides.delete(slideId);
      }
      return { previewSlidesRevision: s.previewSlidesRevision + 1 };
    }),

  clearPreviewHighlightSetting: (highlightId, key) =>
    set((s) => {
      if (key) {
        const current = s.previewHighlights.get(highlightId);
        if (!current) return s;
        delete current[key as keyof typeof current];
        if (Object.keys(current).length === 0) s.previewHighlights.delete(highlightId);
      } else {
        s.previewHighlights.delete(highlightId);
      }
      return { previewHighlightsRevision: s.previewHighlightsRevision + 1 };
    }),

  clearAllPreviewSettings: () =>
    set((s) => {
      s.previewProject = {};
      s.previewSlides.clear();
      s.previewHighlights.clear();
      return {
        previewProject: s.previewProject,
        previewSlidesRevision: s.previewSlidesRevision + 1,
        previewHighlightsRevision: s.previewHighlightsRevision + 1,
      };
    }),
});
