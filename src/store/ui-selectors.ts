/**
 * ui-selectors — Zustand slices defined OUTSIDE components.
 * Each hook selects only the fields it needs, preventing the whole
 * editor tree from re-rendering on every keystroke / saveStatus / localCode change.
 *
 * Use `useShallow` for object slices so referential equality is preserved
 * when none of the selected fields changed.
 */
import { useUiStore } from "./useUiStore";
import { useShallow } from "zustand/react/shallow";
import type { UiState } from "./useUiStore";

// Raw selector functions (exported for use outside React if needed)
export const selectors = {
  presenting: (s: UiState) => s.isPresenting,
  autoPlaying: (s: UiState) => s.isAutoPlaying,
  zen: (s: UiState) => s.isZenMode,
  saveStatus: (s: UiState) => s.saveStatus,
  theme: (s: UiState) => s.isDarkUi,
  dialogs: (s: UiState) => ({
    isSettingsOpen: s.isSettingsOpen,
    isCommandOpen: s.isCommandOpen,
    isShortcutsOpen: s.isShortcutsOpen,
  }),
  currentSlide: (s: UiState) => s.currentSlideId,
  previewHighlight: (s: UiState) => s.previewHighlightIndex,
  panelPrefs: (s: UiState) => ({
    isBottomPanelCollapsed: s.isBottomPanelCollapsed,
    isCodePanelCollapsed: s.isCodePanelCollapsed,
    codePanelSize: s.codePanelSize,
    slidesPanelSize: s.slidesPanelSize,
  }),
};

// --- Focused slice hooks ---

export function usePresentingSlice() {
  return useUiStore(
    useShallow((s) => ({
      isPresenting: s.isPresenting,
      setIsPresenting: s.setIsPresenting,
    }))
  );
}

export function useAutoPlaySlice() {
  return useUiStore(
    useShallow((s) => ({
      isAutoPlaying: s.isAutoPlaying,
      setIsAutoPlaying: s.setIsAutoPlaying,
      toggleAutoPlaying: s.toggleAutoPlaying,
    }))
  );
}

export function usePresentationControls() {
  return useUiStore(
    useShallow((s) => ({
      isPresenting: s.isPresenting,
      setIsPresenting: s.setIsPresenting,
      isAutoPlaying: s.isAutoPlaying,
      setIsAutoPlaying: s.setIsAutoPlaying,
      toggleAutoPlaying: s.toggleAutoPlaying,
    }))
  );
}

export function useZenSlice() {
  return useUiStore(
    useShallow((s) => ({
      isZenMode: s.isZenMode,
      setIsZenMode: s.setIsZenMode,
      toggleZenMode: s.toggleZenMode,
    }))
  );
}

export function useThemeSlice() {
  return useUiStore(
    useShallow((s) => ({
      isDarkUi: s.isDarkUi,
      setIsDarkUi: s.setIsDarkUi,
      toggleTheme: s.toggleTheme,
    }))
  );
}

export function useDialogsSlice() {
  return useUiStore(
    useShallow((s) => ({
      isSettingsOpen: s.isSettingsOpen,
      setIsSettingsOpen: s.setIsSettingsOpen,
      isCommandOpen: s.isCommandOpen,
      setIsCommandOpen: s.setIsCommandOpen,
      isShortcutsOpen: s.isShortcutsOpen,
      setIsShortcutsOpen: s.setIsShortcutsOpen,
      toggleShortcutsOpen: s.toggleShortcutsOpen,
    }))
  );
}

export function useSaveStatusSlice() {
  return useUiStore((s) => s.saveStatus);
}

export function usePanelSlice() {
  return useUiStore(
    useShallow((s) => ({
      isBottomPanelCollapsed: s.isBottomPanelCollapsed,
      setIsBottomPanelCollapsed: s.setIsBottomPanelCollapsed,
      isCodePanelCollapsed: s.isCodePanelCollapsed,
      setIsCodePanelCollapsed: s.setIsCodePanelCollapsed,
      codePanelSize: s.codePanelSize,
      setCodePanelSize: s.setCodePanelSize,
      slidesPanelSize: s.slidesPanelSize,
      setSlidesPanelSize: s.setSlidesPanelSize,
    }))
  );
}

export function useCurrentSlideSlice() {
  return useUiStore(
    useShallow((s) => ({
      currentSlideId: s.currentSlideId,
      setCurrentSlideId: s.setCurrentSlideId,
    }))
  );
}

export function usePreviewHighlightSlice() {
  return useUiStore((s) => s.previewHighlightIndex);
}


export function useToolbarSlice() {
  return useUiStore(
    useShallow((s) => ({
      saveStatus: s.saveStatus,
      isAutoPlaying: s.isAutoPlaying,
      toggleAutoPlaying: s.toggleAutoPlaying,
      setIsAutoPlaying: s.setIsAutoPlaying,
      isDarkUi: s.isDarkUi,
      toggleTheme: s.toggleTheme,
      isZenMode: s.isZenMode,
      toggleZenMode: s.toggleZenMode,
      isSettingsOpen: s.isSettingsOpen,
      setIsSettingsOpen: s.setIsSettingsOpen,
      isCommandOpen: s.isCommandOpen,
      setIsCommandOpen: s.setIsCommandOpen,
      isPresenting: s.isPresenting,
      setIsPresenting: s.setIsPresenting,
    }))
  );
}
