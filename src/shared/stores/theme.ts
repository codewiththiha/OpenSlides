/** Apply the UI theme class to <html> (single place that owns the DOM side
 *  effect — previously duplicated in Dashboard, Editor and CommandPalette).
 *  Exported for the one legitimate non-action caller: re-applying the
 *  persisted theme on app start (persisted state hydrates without running
 *  the store setters, so the DOM is synced once at startup). */
export function applyUiTheme(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.classList.toggle("light", !dark);
}
