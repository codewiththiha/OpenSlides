import type { StateCreator } from "zustand";
import type { UiState } from "../types";

export interface DialogSlice {
  isSettingsOpen: boolean;
  isCommandOpen: boolean;
  isGoToSlideOpen: boolean;
  isShortcutsOpen: boolean;
  setIsGoToSlideOpen: (v: boolean) => void;
  setIsSettingsOpen: (v: boolean) => void;
  setIsCommandOpen: (v: boolean) => void;
  setIsShortcutsOpen: (v: boolean) => void;
  toggleShortcutsOpen: () => void;
}

export const createDialogSlice: StateCreator<UiState, [], [], DialogSlice> = (set) => ({
  isSettingsOpen: false,
  isCommandOpen: false,
  isGoToSlideOpen: false,
  isShortcutsOpen: false,

  setIsGoToSlideOpen: (v) => set({ isGoToSlideOpen: v }),
  setIsSettingsOpen: (v) => set({ isSettingsOpen: v }),
  setIsCommandOpen: (v) => set({ isCommandOpen: v }),
  setIsShortcutsOpen: (v) => set({ isShortcutsOpen: v }),
  toggleShortcutsOpen: () => set((s) => ({ isShortcutsOpen: !s.isShortcutsOpen })),
});
