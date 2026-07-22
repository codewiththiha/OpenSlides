/**
 * UI state — panel layout prefs persist across restarts via localStorage.
 * Project/slide data still lives in TanStack Query + Rust SQLite.
 * Preview overrides are transient (not persisted) for instant slider feedback.
 *
 * Composed from Zustand slices in src/store/slices/:
 *   presentationSlice, panelSlice, dialogSlice, prefsSlice, previewSlice
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  setLocalCodeAtom,
  clearLocalCodeAtom,
  clearAllLocalCodeAtoms,
} from "./localCodeAtoms";
import { clearCaretPositions } from "./caretPositions";
import { createPresentationSlice } from "./slices/presentationSlice";
import { createPanelSlice } from "./slices/panelSlice";
import { createDialogSlice } from "./slices/dialogSlice";
import { createPrefsSlice } from "./slices/prefsSlice";
import { createPreviewSlice } from "./slices/previewSlice";
import type { UiState } from "./types";

export type { PreviewProjectSettings, PreviewSlideSettings, UiState } from "./types";
export { applyUiTheme } from "./theme";

export const useUiStore = create<UiState>()(
  persist(
    (set, get, api) => ({
      ...createPresentationSlice(set, get, api),
      ...createPanelSlice(set, get, api),
      ...createDialogSlice(set, get, api),
      ...createPrefsSlice(set, get, api),
      ...createPreviewSlice(set, get, api),

      // Cross-cutting actions (depend on atoms / non-slice state)
      setLocalCode: (slideId, code) => {
        setLocalCodeAtom(slideId, code);
      },
      clearLocalCode: (slideId) => {
        clearLocalCodeAtom(slideId);
      },

      resetEditorUi: () => {
        clearAllLocalCodeAtoms();
        clearCaretPositions();
        set((s) => {
          s.previewSlides.clear();
          s.previewHighlights.clear();
          return {
            currentSlideId: null,
            isPresenting: false,
            isAutoPlaying: false,
            isZenMode: false,
            isSettingsOpen: false,
            isGoToSlideOpen: false,
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
      version: 1,
      // Existing installations retain their old, taller persisted slide rail.
      // Reset that one layout value once so the new compact default is visible.
      migrate: (persistedState, version) => {
        if (version < 1 && persistedState && typeof persistedState === "object") {
          return { ...persistedState, slidesPanelSize: 14 };
        }
        return persistedState;
      },
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        isBottomPanelCollapsed: s.isBottomPanelCollapsed,
        isCodePanelCollapsed: s.isCodePanelCollapsed,
        codePanelSize: s.codePanelSize,
        slidesPanelSize: s.slidesPanelSize,
        isDarkUi: s.isDarkUi,
        editorShowLineNumbers: s.editorShowLineNumbers,
        showSlideHoverPreview: s.showSlideHoverPreview,
      }),
    },
  ),
);
