/**
 * UI state — panel layout prefs persist across restarts via localStorage.
 * Project/slide data still lives in TanStack Query + Rust SQLite.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface UiState {
  currentSlideId: string | null;
  isPresenting: boolean;
  isZenMode: boolean;
  isBottomPanelCollapsed: boolean;
  isCodePanelCollapsed: boolean;
  /** Last expanded size (%) of the code panel before collapse. */
  codePanelSize: number;
  /** Last expanded size (%) of the slides panel before collapse. */
  slidesPanelSize: number;
  isSettingsOpen: boolean;
  isCommandOpen: boolean;
  isDarkUi: boolean;
  editorShowLineNumbers: boolean;
  localCode: Record<string, string>;
  saveStatus: "idle" | "saving" | "saved" | "error";

  setCurrentSlideId: (id: string | null) => void;
  setIsPresenting: (v: boolean) => void;
  setIsZenMode: (v: boolean) => void;
  toggleZenMode: () => void;
  setIsBottomPanelCollapsed: (v: boolean) => void;
  setIsCodePanelCollapsed: (v: boolean) => void;
  setCodePanelSize: (v: number) => void;
  setSlidesPanelSize: (v: number) => void;
  setIsSettingsOpen: (v: boolean) => void;
  setIsCommandOpen: (v: boolean) => void;
  setIsDarkUi: (v: boolean) => void;
  setEditorShowLineNumbers: (v: boolean) => void;
  setLocalCode: (slideId: string, code: string) => void;
  clearLocalCode: (slideId: string) => void;
  setSaveStatus: (s: UiState["saveStatus"]) => void;
  resetEditorUi: () => void;
}

const DEFAULT_CODE_SIZE = 42;
const DEFAULT_SLIDES_SIZE = 22;

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      currentSlideId: null,
      isPresenting: false,
      isZenMode: false,
      isBottomPanelCollapsed: false,
      isCodePanelCollapsed: false,
      codePanelSize: DEFAULT_CODE_SIZE,
      slidesPanelSize: DEFAULT_SLIDES_SIZE,
      isSettingsOpen: false,
      isCommandOpen: false,
      isDarkUi: true,
      editorShowLineNumbers: true,
      localCode: {},
      saveStatus: "idle",

      setCurrentSlideId: (id) => set({ currentSlideId: id }),
      setIsPresenting: (v) => set({ isPresenting: v }),
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
      setIsDarkUi: (v) => set({ isDarkUi: v }),
      setEditorShowLineNumbers: (v) => set({ editorShowLineNumbers: v }),
      setLocalCode: (slideId, code) =>
        set((s) => ({ localCode: { ...s.localCode, [slideId]: code } })),
      clearLocalCode: (slideId) =>
        set((s) => {
          const next = { ...s.localCode };
          delete next[slideId];
          return { localCode: next };
        }),
      setSaveStatus: (saveStatus) => set({ saveStatus }),
      resetEditorUi: () =>
        set({
          currentSlideId: null,
          isPresenting: false,
          isZenMode: false,
          isSettingsOpen: false,
          localCode: {},
          saveStatus: "idle",
          // keep panel collapse prefs / sizes / theme across navigations
        }),
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
