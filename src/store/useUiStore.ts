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
  localCode: Record<string, string>;
  saveStatus: "idle" | "saving" | "saved" | "error";
  /** Highlight index being previewed from the editor (-1 = none). */
  previewHighlightIndex: number;
  /** Caret position per slide — massive UX win for multi-slide editing */
  caretPositions: Record<string, { start: number; end: number }>;

  /** Instant UI preview overrides (not persisted) — separate from DB state */
  previewProject: PreviewProjectSettings;
  previewSlides: Record<string, PreviewSlideSettings>;
  previewHighlights: Record<string, Partial<import("@/types").Highlight>>;

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
  setLocalCode: (slideId: string, code: string) => void;
  clearLocalCode: (slideId: string) => void;
  setSaveStatus: (s: UiState["saveStatus"]) => void;
  setPreviewHighlightIndex: (v: number) => void;
  setCaretPosition: (slideId: string, start: number, end: number) => void;
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
      localCode: {},
      saveStatus: "idle",
      previewHighlightIndex: -1,
      caretPositions: {},
      previewProject: {},
      previewSlides: {},
      previewHighlights: {},

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
      setLocalCode: (slideId, code) => {
        setLocalCodeAtom(slideId, code);
        set((s) => ({ localCode: { ...s.localCode, [slideId]: code } }));
      },
      clearLocalCode: (slideId) => {
        clearLocalCodeAtom(slideId);
        set((s) => {
          const next = { ...s.localCode };
          delete next[slideId];
          return { localCode: next };
        });
      },
      setSaveStatus: (saveStatus) => set({ saveStatus }),
      setPreviewHighlightIndex: (v) => set({ previewHighlightIndex: v }),
      setCaretPosition: (slideId, start, end) =>
        set((s) => ({
          caretPositions: { ...s.caretPositions, [slideId]: { start, end } },
        })),

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
          const current = s.previewSlides[slideId] ?? {};
          if (value === null || value === undefined) {
            const nextSlide = { ...current };
            delete (nextSlide as Record<string, unknown>)[key];
            if (Object.keys(nextSlide).length === 0) {
              const nextAll = { ...s.previewSlides };
              delete nextAll[slideId];
              return { previewSlides: nextAll };
            }
            return {
              previewSlides: { ...s.previewSlides, [slideId]: nextSlide },
            };
          }
          return {
            previewSlides: {
              ...s.previewSlides,
              [slideId]: { ...current, [key]: value },
            },
          };
        }),
      setPreviewHighlightSetting: (highlightId, patch) =>
        set((s) => {
          const current = s.previewHighlights[highlightId] ?? {};
          const next: Record<string, unknown> = { ...current };
          for (const [k, v] of Object.entries(patch as Record<string, unknown>)) {
            if (v === null || v === undefined) {
              delete next[k];
            } else {
              next[k] = v;
            }
          }
          if (Object.keys(next).length === 0) {
            const nextAll = { ...s.previewHighlights };
            delete nextAll[highlightId];
            return { previewHighlights: nextAll };
          }
          return {
            previewHighlights: {
              ...s.previewHighlights,
              [highlightId]: next as Partial<import("@/types").Highlight>,
            },
          };
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
            const cur = s.previewSlides[slideId];
            if (!cur) return s;
            const nextSlide = { ...cur };
            delete (nextSlide as Record<string, unknown>)[key];
            if (Object.keys(nextSlide).length === 0) {
              const nextAll = { ...s.previewSlides };
              delete nextAll[slideId];
              return { previewSlides: nextAll };
            }
            return {
              previewSlides: { ...s.previewSlides, [slideId]: nextSlide },
            };
          }
          const nextAll = { ...s.previewSlides };
          delete nextAll[slideId];
          return { previewSlides: nextAll };
        }),
      clearPreviewHighlightSetting: (highlightId, key) =>
        set((s) => {
          if (key) {
            const cur = s.previewHighlights[highlightId];
            if (!cur) return s;
            const next = { ...cur } as Record<string, unknown>;
            delete next[key];
            if (Object.keys(next).length === 0) {
              const nextAll = { ...s.previewHighlights };
              delete nextAll[highlightId];
              return { previewHighlights: nextAll };
            }
            return {
              previewHighlights: {
                ...s.previewHighlights,
                [highlightId]: next as Partial<import("@/types").Highlight>,
              },
            };
          }
          const nextAll = { ...s.previewHighlights };
          delete nextAll[highlightId];
          return { previewHighlights: nextAll };
        }),
      clearAllPreviewSettings: () =>
        set({
          previewProject: {},
          previewSlides: {},
          previewHighlights: {},
        }),

      resetEditorUi: () => {
        clearAllLocalCodeAtoms();
        return set({
          currentSlideId: null,
          isPresenting: false,
          isAutoPlaying: false,
          isZenMode: false,
          isSettingsOpen: false,
          isShortcutsOpen: false,
          localCode: {},
          saveStatus: "idle",
          previewHighlightIndex: -1,
          caretPositions: {},
          previewProject: {},
          previewSlides: {},
          previewHighlights: {},
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
