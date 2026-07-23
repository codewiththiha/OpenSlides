/**
 * UI-state persistence — the single owner of the localStorage wire format
 * ({ state, version }) for panel/theme prefs. Both the pre-paint bootstrap
 * in main.ts and the reactive store in ui-state.svelte.ts go through here.
 */
import { applyUiTheme } from "./theme";

export const UI_STORAGE_KEY = "openslides-ui";
export const UI_STORAGE_VERSION = 2;
export const DEFAULT_CODE_SIZE = 42;
export const DEFAULT_SLIDES_SIZE = 14;

export interface PersistedUiState {
  isBottomPanelCollapsed: boolean;
  isCodePanelCollapsed: boolean;
  codePanelSize: number;
  slidesPanelSize: number;
  isDarkUi: boolean;
  editorShowLineNumbers: boolean;
  showSlideHoverPreview: boolean;
}

/** Synchronous hydration — persisted state must exist before first render. */
export function loadPersistedUiState(): Partial<PersistedUiState> {
  try {
    const raw = localStorage.getItem(UI_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as {
      state?: Partial<PersistedUiState>;
      version?: number;
    };
    const state = { ...(parsed.state ?? {}) };
    // Keep the compact slides rail as the baseline regardless of an older
    // saved layout (migrate any persisted version below UI_STORAGE_VERSION).
    if ((parsed.version ?? 0) < UI_STORAGE_VERSION) {
      state.slidesPanelSize = DEFAULT_SLIDES_SIZE;
    }
    return state;
  } catch {
    return {};
  }
}

export function savePersistedUiState(state: PersistedUiState): void {
  try {
    localStorage.setItem(
      UI_STORAGE_KEY,
      JSON.stringify({ state, version: UI_STORAGE_VERSION }),
    );
  } catch {
    /* storage full / unavailable — session-only prefs */
  }
}

/**
 * Pre-paint theme bootstrap for app startup: read only the persisted theme
 * flag and sync <html> before first paint.
 */
export function initInitialTheme(): void {
  applyUiTheme(loadPersistedUiState().isDarkUi ?? true);
}
