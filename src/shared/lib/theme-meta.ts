/**
 * Theme metadata — the single source of truth. `ThemeName` is derived from
 * the THEMES list, so adding a theme here updates the type automatically.
 */

export const THEMES = [
  { value: "dark-plus", label: "Dark+", background: "#1e1e1e", light: false },
  { value: "dracula", label: "Dracula", background: "#282a36", light: false },
  {
    value: "github-dark",
    label: "GitHub Dark",
    background: "#24292e",
    light: false,
  },
  {
    value: "github-light",
    label: "GitHub Light",
    background: "#ffffff",
    light: true,
  },
  { value: "nord", label: "Nord", background: "#2e3440", light: false },
  {
    value: "poimandres",
    label: "Poimandres",
    background: "#1b1e28",
    light: false,
  },
  { value: "min-dark", label: "Min Dark", background: "#1f1f1f", light: false },
  {
    value: "min-light",
    label: "Min Light",
    background: "#ffffff",
    light: true,
  },
  { value: "monokai", label: "Monokai", background: "#272822", light: false },
  {
    value: "solarized-dark",
    label: "Solarized Dark",
    background: "#002b36",
    light: false,
  },
  {
    value: "solarized-light",
    label: "Solarized Light",
    background: "#fdf6e3",
    light: true,
  },
  {
    value: "andromeeda",
    label: "Andromeeda",
    background: "#23262e",
    light: false,
  },
  { value: "aurora-x", label: "Aurora X", background: "#07090f", light: false },
  {
    value: "catppuccin-mocha",
    label: "Catppuccin Mocha",
    background: "#1e1e2e",
    light: false,
  },
  {
    value: "catppuccin-latte",
    label: "Catppuccin Latte",
    background: "#eff1f5",
    light: true,
  },
  {
    value: "night-owl",
    label: "Night Owl",
    background: "#011627",
    light: false,
  },
] as const;

export type ThemeName = (typeof THEMES)[number]["value"];

export interface ThemeMeta {
  value: ThemeName;
  label: string;
  background: string;
  light: boolean;
}
