/**
 * Ephemeral UI state only — never persisted.
 * All project/slide data lives in TanStack Query + Rust SQLite.
 */
import { create } from "zustand";

interface UiState {
  currentSlideId: string | null;
  isPresenting: boolean;
  isZenMode: boolean;
  isBottomPanelCollapsed: boolean;
  isCodePanelCollapsed: boolean;
  isSettingsOpen: boolean;
  isCommandOpen: boolean;
  isDarkUi: boolean;
  /** Editor gutter line numbers — always on by default; controlled in settings only. */
  editorShowLineNumbers: boolean;
  localCode: Record<string, string>;
  saveStatus: "idle" | "saving" | "saved" | "error";

  setCurrentSlideId: (id: string | null) => void;
  setIsPresenting: (v: boolean) => void;
  setIsZenMode: (v: boolean) => void;
  toggleZenMode: () => void;
  setIsBottomPanelCollapsed: (v: boolean) => void;
  setIsCodePanelCollapsed: (v: boolean) => void;
  setIsSettingsOpen: (v: boolean) => void;
  setIsCommandOpen: (v: boolean) => void;
  setIsDarkUi: (v: boolean) => void;
  setEditorShowLineNumbers: (v: boolean) => void;
  setLocalCode: (slideId: string, code: string) => void;
  clearLocalCode: (slideId: string) => void;
  setSaveStatus: (s: UiState["saveStatus"]) => void;
  resetEditorUi: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  currentSlideId: null,
  isPresenting: false,
  isZenMode: false,
  isBottomPanelCollapsed: false,
  isCodePanelCollapsed: false,
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
      isBottomPanelCollapsed: false,
      isCodePanelCollapsed: false,
      isSettingsOpen: false,
      localCode: {},
      saveStatus: "idle",
    }),
}));
