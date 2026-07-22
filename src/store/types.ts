/** Shared store types — imported by slices and the main store. */

export type PreviewProjectSettings = {
  theme?: string;
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
  isAutoPlaying: boolean;
  isZenMode: boolean;
  isBottomPanelCollapsed: boolean;
  isCodePanelCollapsed: boolean;
  codePanelSize: number;
  slidesPanelSize: number;
  isSettingsOpen: boolean;
  isCommandOpen: boolean;
  isGoToSlideOpen: boolean;
  isShortcutsOpen: boolean;
  setIsGoToSlideOpen: (v: boolean) => void;
  isDarkUi: boolean;
  editorShowLineNumbers: boolean;
  showSlideHoverPreview: boolean;
  saveStatus: "idle" | "saving" | "saved" | "error";
  previewHighlightIndex: number;
  previewProject: PreviewProjectSettings;
  previewSlides: Map<string, PreviewSlideSettings>;
  previewHighlights: Map<string, Partial<import("@/types").Highlight>>;
  previewSlidesRevision: number;
  previewHighlightsRevision: number;

  setCurrentSlideId: (id: string | null) => void;
  setIsPresenting: (v: boolean) => void;
  setIsAutoPlaying: (v: boolean) => void;
  toggleAutoPlaying: () => void;
  toggleZenMode: () => void;
  setIsBottomPanelCollapsed: (v: boolean) => void;
  setIsCodePanelCollapsed: (v: boolean) => void;
  setCodePanelSize: (v: number) => void;
  setSlidesPanelSize: (v: number) => void;
  setIsSettingsOpen: (v: boolean) => void;
  setIsCommandOpen: (v: boolean) => void;
  setIsShortcutsOpen: (v: boolean) => void;
  toggleShortcutsOpen: () => void;
  toggleTheme: () => void;
  setEditorShowLineNumbers: (v: boolean) => void;
  setShowSlideHoverPreview: (v: boolean) => void;
  setLocalCode: (slideId: string, code: string) => void;
  clearLocalCode: (slideId: string) => void;
  setSaveStatus: (s: UiState["saveStatus"]) => void;
  setPreviewHighlightIndex: (v: number) => void;
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
