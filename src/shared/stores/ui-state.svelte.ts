/**
 * Facade: single import surface for UI state (§6.4).
 *
 * The state object lives in ui/ui-object.svelte.ts; setters are sliced by
 * concern:
 *   ui/presentation.ts — current slide, presenting, autoplay
 *   ui/panels.ts       — panel collapse + sizes (persisted)
 *   ui/dialogs.ts      — dialog visibility flags
 *   ui/prefs.ts        — theme, zen mode, editor prefs, save status
 *   ui/preview.ts      — transient preview-setting overrides
 *   ui/reset.ts        — resetEditorUi (leaving a project)
 *
 * Every re-exported module evaluates eagerly, so the startup side effects
 * in ui-object (theme hydration, persistence effect) run from any import.
 */
export { ui } from "./ui/ui-object.svelte";
export {
  setCurrentSlideId,
  setIsPresenting,
  setIsAutoPlaying,
  toggleAutoPlaying,
} from "./ui/presentation";
export {
  setIsBottomPanelCollapsed,
  setIsCodePanelCollapsed,
  setCodePanelSize,
  setSlidesPanelSize,
} from "./ui/panels";
export {
  setIsGoToSlideOpen,
  setIsSettingsOpen,
  setIsCommandOpen,
  setIsShortcutsOpen,
  toggleShortcutsOpen,
} from "./ui/dialogs";
export {
  toggleZenMode,
  toggleTheme,
  setEditorShowLineNumbers,
  setShowSlideHoverPreview,
  setSaveStatus,
} from "./ui/prefs";
export {
  setPreviewHighlightIndex,
  setPreviewProjectSetting,
  setPreviewSlideSetting,
  setPreviewHighlightSetting,
  clearPreviewProjectSetting,
  clearPreviewSlideSetting,
  clearPreviewHighlightSetting,
  clearAllPreviewSettings,
} from "./ui/preview";
export { resetEditorUi } from "./ui/reset";

export { applyUiTheme } from "./theme";
export { clearLocalCode } from "./slide-code.svelte";
