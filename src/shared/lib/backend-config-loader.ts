import { api } from "./tauri-api";
import {
  cachedDefaultProjectSettings,
  setDefaultProjectSettings,
  setSupportedLanguageOptions,
  setSupportedThemeOptions,
  type DefaultProjectSettingsSnapshot,
} from "./backend-config.svelte";

let initStarted = false;

/** Fetch backend-owned metadata once and cache it for the session. */
export async function initBackendConfig(): Promise<void> {
  if (initStarted) return;
  initStarted = true;

  await Promise.all([
    api
      .getSupportedLanguages()
      .then((options) => setSupportedLanguageOptions(options))
      .catch(() => {}),
    api
      .getSupportedThemes()
      .then((options) => setSupportedThemeOptions(options))
      .catch(() => {}),
    loadDefaultProjectSettings().catch(() => null),
  ]);
}

/** Lazily fetch the backend's default project settings. */
export async function loadDefaultProjectSettings(): Promise<DefaultProjectSettingsSnapshot | null> {
  const cached = cachedDefaultProjectSettings();
  if (cached) return cached;
  try {
    const settings =
      await api.getDefaultSettings<DefaultProjectSettingsSnapshot>();
    setDefaultProjectSettings(settings);
    return settings;
  } catch {
    return null;
  }
}
