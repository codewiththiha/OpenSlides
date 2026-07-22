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
        set(() => {
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
            previewSlides: new Map(),
            previewHighlights: new Map(),
          };
        });
      },
    }),
    {
      name: "openslides-ui",
      version: 2,
      // Keep the compact slides rail as the baseline for both existing and
      // newly created presentations, regardless of an older saved layout.
      migrate: (persistedState, version) => {
        if (version < 2 && persistedState && typeof persistedState === "object") {
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
