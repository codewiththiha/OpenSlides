/**
 * UI state — panel layout prefs persist across restarts via localStorage.
 * Project/slide data still lives in TanStack Query + Rust SQLite.
 * Preview overrides are transient (not persisted) for instant slider feedback.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  setLocalCodeAtom,
  clearLocalCodeAtom,
  clearAllLocalCodeAtoms,
} from "./localCodeAtoms";
import { clearCaretPositions } from "./caretPositions";

export type PreviewProjectSettings = {
  fontSize?: number;
  lineHeight?: number;
  editorFontSize?: number;
  globalTransitionDuration?: number;
  globalStagger?: number;
};

export type PreviewSlideSettings = {
  transitionDuration?: number;
  stagger?: number;
  duration?: number;
};

export interface UiState {
  currentSlideId: string | null;
  isPresenting: boolean;
  /** Auto-advance slides using each slide's duration. */
  isAutoPlaying: boolean;
  isZenMode: boolean;
  isBottomPanelCollapsed: boolean;
  isCodePanelCollapsed: boolean;
  /** Last expanded size (%) of the code panel before collapse. */
  codePanelSize: number;
  /** Last expanded size (%) of the slides panel before collapse. */
  slidesPanelSize: number;
  isSettingsOpen: boolean;
  isCommandOpen: boolean;
  isShortcutsOpen: boolean;
  isDarkUi: boolean;
  editorShowLineNumbers: boolean;
  saveStatus: "idle" | "saving" | "saved" | "error";
  /** Highlight index being previewed from the editor (-1 = none). */
  previewHighlightIndex: number;
  /** Instant UI preview overrides (not persisted) — separate from DB state */
  previewProject: PreviewProjectSettings;
  previewSlides: Map<string, PreviewSlideSettings>;
  previewHighlights: Map<string, Partial<import("@/types").Highlight>>;
  previewSlidesRevision: number;
  previewHighlightsRevision: number;

  setCurrentSlideId: (id: string | null) => void;
  setIsPresenting: (v: boolean) => void;
  setIsAutoPlaying: (v: boolean) => void;
  toggleAutoPlaying: () => void;
  setIsZenMode: (v: boolean) => void;
  toggleZenMode: () => void;
  setIsBottomPanelCollapsed: (v: boolean) => void;
  setIsCodePanelCollapsed: (v: boolean) => void;
  setCodePanelSize: (v: number) => void;
  setSlidesPanelSize: (v: number) => void;
  setIsSettingsOpen: (v: boolean) => void;
  setIsCommandOpen: (v: boolean) => void;
  setIsShortcutsOpen: (v: boolean) => void;
  toggleShortcutsOpen: () => void;
  setIsDarkUi: (v: boolean) => void;
  toggleTheme: () => void;
  setEditorShowLineNumbers: (v: boolean) => void;
  // localCode per-slide atom only — no Zustand mirror (O(n) spread removed)
  setLocalCode: (slideId: string, code: string) => void;
  clearLocalCode: (slideId: string) => void;
  setSaveStatus: (s: UiState["saveStatus"]) => void;
  setPreviewHighlightIndex: (v: number) => void;
  resetEditorUi: () => void;

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

const DEFAULT_CODE_SIZE = 42;
const DEFAULT_SLIDES_SIZE = 22;

/** Apply the UI theme class to <html> (single place that owns the DOM side
 *  effect — previously duplicated in Dashboard, Editor and CommandPalette).
 *  Exported for the one legitimate non-action caller: re-applying the
 *  persisted theme on app start (zustand-persist hydrates state without
 *  running actions, so Dashboard syncs the DOM once on mount). */
export function applyUiTheme(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.classList.toggle("light", !dark);
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      currentSlideId: null,
      isPresenting: false,
      isAutoPlaying: false,
      isZenMode: false,
      isBottomPanelCollapsed: false,
      isCodePanelCollapsed: false,
      codePanelSize: DEFAULT_CODE_SIZE,
      slidesPanelSize: DEFAULT_SLIDES_SIZE,
      isSettingsOpen: false,
      isCommandOpen: false,
      isShortcutsOpen: false,
      isDarkUi: true,
      editorShowLineNumbers: true,
      saveStatus: "idle",
      previewHighlightIndex: -1,
      previewProject: {},
      previewSlides: new Map(),
      previewHighlights: new Map(),
      previewSlidesRevision: 0,
      previewHighlightsRevision: 0,

      setCurrentSlideId: (id) => set({ currentSlideId: id }),
      setIsPresenting: (v) => set({ isPresenting: v }),
      setIsAutoPlaying: (v) => set({ isAutoPlaying: v }),
      toggleAutoPlaying: () => set((s) => ({ isAutoPlaying: !s.isAutoPlaying })),
      setIsZenMode: (v) => set({ isZenMode: v }),
      toggleZenMode: () => set((s) => ({ isZenMode: !s.isZenMode })),
      setIsBottomPanelCollapsed: (v) => set({ isBottomPanelCollapsed: v }),
      setIsCodePanelCollapsed: (v) => set({ isCodePanelCollapsed: v }),
      setCodePanelSize: (v) =>
        set({
          codePanelSize: Math.min(70, Math.max(18, Math.round(v))),
        }),
      setSlidesPanelSize: (v) =>
        set({
          slidesPanelSize: Math.min(40, Math.max(12, Math.round(v))),
        }),
      setIsSettingsOpen: (v) => set({ isSettingsOpen: v }),
      setIsCommandOpen: (v) => set({ isCommandOpen: v }),
      setIsShortcutsOpen: (v) => set({ isShortcutsOpen: v }),
      toggleShortcutsOpen: () => set((s) => ({ isShortcutsOpen: !s.isShortcutsOpen })),
      setIsDarkUi: (v) => {
        applyUiTheme(v);
        set({ isDarkUi: v });
      },
      toggleTheme: () =>
        set((s) => {
          applyUiTheme(!s.isDarkUi);
          return { isDarkUi: !s.isDarkUi };
        }),
      setEditorShowLineNumbers: (v) => set({ editorShowLineNumbers: v }),
      // No Zustand mirror — only per-slide atom, zero re-render storm, no O(n) spread
      setLocalCode: (slideId, code) => {
        setLocalCodeAtom(slideId, code);
      },
      clearLocalCode: (slideId) => {
        clearLocalCodeAtom(slideId);
      },
      setSaveStatus: (saveStatus) => set({ saveStatus }),
      setPreviewHighlightIndex: (v) => set({ previewHighlightIndex: v }),
      setPreviewProjectSetting: (key, value) =>
        set((s) => {
          if (value === null || value === undefined) {
            const next = { ...s.previewProject };
            delete (next as Record<string, unknown>)[key];
            return { previewProject: next };
          }
          return {
            previewProject: { ...s.previewProject, [key]: value },
          };
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

      resetEditorUi: () => {
        clearAllLocalCodeAtoms();
        clearCaretPositions();
        return set((s) => {
          s.previewSlides.clear();
          s.previewHighlights.clear();
          return {
          currentSlideId: null,
          isPresenting: false,
          isAutoPlaying: false,
          isZenMode: false,
          isSettingsOpen: false,
          isShortcutsOpen: false,
          saveStatus: "idle",
          previewHighlightIndex: -1,
          previewProject: {},
          previewSlidesRevision: s.previewSlidesRevision + 1,
          previewHighlightsRevision: s.previewHighlightsRevision + 1,
        };
        });
      },
    }),
    {
      name: "openslides-ui",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        isBottomPanelCollapsed: s.isBottomPanelCollapsed,
        isCodePanelCollapsed: s.isCodePanelCollapsed,
        codePanelSize: s.codePanelSize,
        slidesPanelSize: s.slidesPanelSize,
        isDarkUi: s.isDarkUi,
        editorShowLineNumbers: s.editorShowLineNumbers,
      }),
    },
  ),
);
