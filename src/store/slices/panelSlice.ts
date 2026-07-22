import type { StateCreator } from "zustand";
import type { UiState } from "../types";

const DEFAULT_CODE_SIZE = 42;
const DEFAULT_SLIDES_SIZE = 22;

export interface PanelSlice {
  isBottomPanelCollapsed: boolean;
  isCodePanelCollapsed: boolean;
  codePanelSize: number;
  slidesPanelSize: number;
  setIsBottomPanelCollapsed: (v: boolean) => void;
  setIsCodePanelCollapsed: (v: boolean) => void;
  setCodePanelSize: (v: number) => void;
  setSlidesPanelSize: (v: number) => void;
}

export const createPanelSlice: StateCreator<UiState, [], [], PanelSlice> = (set) => ({
  isBottomPanelCollapsed: false,
  isCodePanelCollapsed: false,
  codePanelSize: DEFAULT_CODE_SIZE,
  slidesPanelSize: DEFAULT_SLIDES_SIZE,

  setIsBottomPanelCollapsed: (v) => set({ isBottomPanelCollapsed: v }),
  setIsCodePanelCollapsed: (v) => set({ isCodePanelCollapsed: v }),
  setCodePanelSize: (v) =>
    set({ codePanelSize: Math.min(70, Math.max(18, Math.round(v))) }),
  setSlidesPanelSize: (v) =>
    set({ slidesPanelSize: Math.min(40, Math.max(20, Math.round(v))) }),
});
