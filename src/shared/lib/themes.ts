import { THEMES, type ThemeMeta, type ThemeName } from "./theme-meta";

export { THEMES } from "./theme-meta";

export const THEME_OPTIONS = THEMES.map(({ value, label }) => ({
  value,
  label,
}));

const THEME_MAP = new Map<ThemeName, ThemeMeta>(
  THEMES.map((t) => [t.value, t] as const),
);

export function themeBackground(theme: string): string {
  return THEME_MAP.get(theme as ThemeName)?.background ?? "#1e1e1e";
}

function isLightTheme(theme: string): boolean {
  return THEME_MAP.get(theme as ThemeName)?.light ?? false;
}

function isDarkTheme(theme: string): boolean {
  return !isLightTheme(theme);
}

export function fallbackForeground(theme: string): string {
  return isDarkTheme(theme) ? "#abb2bf" : "#383a42";
}
