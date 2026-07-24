import { supportedThemeOptions } from "./backend-config.svelte";
import {
  THEMES as FALLBACK_THEMES,
  type ThemeMeta,
  type ThemeName,
} from "./theme-meta";

export { THEMES } from "./theme-meta";

/**
 * Runtime theme list from the backend, with the static metadata table as a
 * fallback before the bootstrap fetch lands (or in browser/test contexts).
 */
export function availableThemes(): ThemeMeta[] {
  return supportedThemeOptions();
}

/** Back-compat static options; runtime consumers should prefer themeOptions(). */
export const THEME_OPTIONS = FALLBACK_THEMES.map(({ value, label }) => ({
  value,
  label,
}));

export function themeOptions(): Array<{ value: ThemeName; label: string }> {
  return availableThemes().map(({ value, label }) => ({ value, label }));
}

function findTheme(theme: string): ThemeMeta | undefined {
  return availableThemes().find((entry) => entry.value === theme);
}

export function themeBackground(theme: string): string {
  return findTheme(theme)?.background ?? "#1e1e1e";
}

function isLightTheme(theme: string): boolean {
  return findTheme(theme)?.light ?? false;
}

function isDarkTheme(theme: string): boolean {
  return !isLightTheme(theme);
}

export function fallbackForeground(theme: string): string {
  return isDarkTheme(theme) ? "#abb2bf" : "#383a42";
}
