/** Apply the UI theme class to <html> (single place that owns the DOM side
 *  effect — previously duplicated in Dashboard, Editor and CommandPalette).
 *  Exported for the one legitimate non-action caller: re-applying the
 *  persisted theme on app start (zustand-persist hydrates state without
 *  running actions, so Dashboard syncs the DOM once on mount). */
export function applyUiTheme(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.classList.toggle("light", !dark);
}
