/** Focused Zustand slices kept outside components to control subscription topology. */
import { useUiStore } from "./useUiStore";
import { useShallow } from "zustand/react/shallow";

export function useEditorSlice() {
  return useUiStore(useShallow((s) => ({ currentSlideId: s.currentSlideId, setCurrentSlideId: s.setCurrentSlideId, isPresenting: s.isPresenting, isZenMode: s.isZenMode, isSettingsOpen: s.isSettingsOpen, setIsSettingsOpen: s.setIsSettingsOpen, resetEditorUi: s.resetEditorUi, previewHighlightIndex: s.previewHighlightIndex, isAutoPlaying: s.isAutoPlaying, setIsAutoPlaying: s.setIsAutoPlaying })));
}

export function usePresentationControls() {
  return useUiStore(useShallow((s) => ({ isPresenting: s.isPresenting, setIsPresenting: s.setIsPresenting, isAutoPlaying: s.isAutoPlaying, setIsAutoPlaying: s.setIsAutoPlaying, toggleAutoPlaying: s.toggleAutoPlaying })));
}

export function useZenSlice() {
  return useUiStore(useShallow((s) => ({ isZenMode: s.isZenMode, setIsZenMode: s.setIsZenMode, toggleZenMode: s.toggleZenMode })));
}

export function usePanelSlice() {
  return useUiStore(useShallow((s) => ({ isBottomPanelCollapsed: s.isBottomPanelCollapsed, setIsBottomPanelCollapsed: s.setIsBottomPanelCollapsed, isCodePanelCollapsed: s.isCodePanelCollapsed, setIsCodePanelCollapsed: s.setIsCodePanelCollapsed, codePanelSize: s.codePanelSize, setCodePanelSize: s.setCodePanelSize, slidesPanelSize: s.slidesPanelSize, setSlidesPanelSize: s.setSlidesPanelSize })));
}

export function useToolbarSlice() {
  return useUiStore(useShallow((s) => ({ saveStatus: s.saveStatus, isAutoPlaying: s.isAutoPlaying, toggleAutoPlaying: s.toggleAutoPlaying, setIsAutoPlaying: s.setIsAutoPlaying, isDarkUi: s.isDarkUi, toggleTheme: s.toggleTheme, isZenMode: s.isZenMode, toggleZenMode: s.toggleZenMode, isSettingsOpen: s.isSettingsOpen, setIsSettingsOpen: s.setIsSettingsOpen, isCommandOpen: s.isCommandOpen, setIsCommandOpen: s.setIsCommandOpen, isPresenting: s.isPresenting, setIsPresenting: s.setIsPresenting })));
}
