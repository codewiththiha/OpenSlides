import type { ThemeName } from "$lib/types";

interface ThemeMeta {
  value: ThemeName;
  label: string;
  background: string;
  light: boolean;
}

export const THEMES: ThemeMeta[] = [
  { value: "dark-plus", label: "Dark+", background: "#1e1e1e", light: false },
  { value: "dracula", label: "Dracula", background: "#282a36", light: false },
  { value: "github-dark", label: "GitHub Dark", background: "#24292e", light: false },
  { value: "github-light", label: "GitHub Light", background: "#ffffff", light: true },
  { value: "nord", label: "Nord", background: "#2e3440", light: false },
  { value: "poimandres", label: "Poimandres", background: "#1b1e28", light: false },
  { value: "min-dark", label: "Min Dark", background: "#1f1f1f", light: false },
  { value: "min-light", label: "Min Light", background: "#ffffff", light: true },
  { value: "monokai", label: "Monokai", background: "#272822", light: false },
  { value: "solarized-dark", label: "Solarized Dark", background: "#002b36", light: false },
  { value: "solarized-light", label: "Solarized Light", background: "#fdf6e3", light: true },
  { value: "andromeeda", label: "Andromeeda", background: "#23262e", light: false },
  { value: "aurora-x", label: "Aurora X", background: "#07090f", light: false },
  { value: "catppuccin-mocha", label: "Catppuccin Mocha", background: "#1e1e2e", light: false },
  { value: "catppuccin-latte", label: "Catppuccin Latte", background: "#eff1f5", light: true },
  { value: "night-owl", label: "Night Owl", background: "#011627", light: false },
];

export const THEME_OPTIONS = THEMES.map(({ value, label }) => ({ value, label }));

const THEME_MAP = new Map<ThemeName, ThemeMeta>(THEMES.map((t) => [t.value, t]));

export function themeBackground(theme: string): string {
  return THEME_MAP.get(theme as ThemeName)?.background ?? "#1e1e1e";
}

export function isLightTheme(theme: string): boolean {
  return THEME_MAP.get(theme as ThemeName)?.light ?? false;
}

export function isDarkTheme(theme: string): boolean {
  return !isLightTheme(theme);
}

export function fallbackForeground(theme: string): string {
  return isDarkTheme(theme) ? "#abb2bf" : "#383a42";
}

export const LIGHT_THEMES = new Set<string>(
  THEMES.filter((t) => t.light).map((t) => t.value)
);
