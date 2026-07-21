import type { StateCreator } from "zustand";
import type { UiState } from "../types";
import { applyUiTheme } from "../theme";

export interface PrefsSlice {
  isZenMode: boolean;
  isDarkUi: boolean;
  editorShowLineNumbers: boolean;
  showSlideHoverPreview: boolean;
  saveStatus: "idle" | "saving" | "saved" | "error";
  toggleZenMode: () => void;
  toggleTheme: () => void;
  setEditorShowLineNumbers: (v: boolean) => void;
  setShowSlideHoverPreview: (v: boolean) => void;
  setSaveStatus: (s: UiState["saveStatus"]) => void;
}

export const createPrefsSlice: StateCreator<UiState, [], [], PrefsSlice> = (set) => ({
  isZenMode: false,
  isDarkUi: true,
  editorShowLineNumbers: true,
  showSlideHoverPreview: false,
  saveStatus: "idle",

  toggleZenMode: () => set((s) => ({ isZenMode: !s.isZenMode })),
  toggleTheme: () =>
    set((s) => {
      applyUiTheme(!s.isDarkUi);
      return { isDarkUi: !s.isDarkUi };
    }),
  setEditorShowLineNumbers: (v) => set({ editorShowLineNumbers: v }),
  setShowSlideHoverPreview: (v) => set({ showSlideHoverPreview: v }),
  setSaveStatus: (saveStatus) => set({ saveStatus }),
});
