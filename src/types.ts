/**
 * Core domain types for OpenSlides desktop.
 * Persistent data is owned by the Rust/SQLite backend;
 * these types mirror the IPC JSON contracts.
 */

export type FontSize = 12 | 14 | 16 | 18 | 20 | 24 | 28 | 32;

export const SUPPORTED_LANGUAGES = [
  { value: "typescript", label: "TypeScript" },
  { value: "javascript", label: "JavaScript" },
  { value: "tsx", label: "React (TSX)" },
  { value: "jsx", label: "React (JSX)" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
  { value: "php", label: "PHP" },
  { value: "css", label: "CSS" },
  { value: "html", label: "HTML" },
  { value: "json", label: "JSON" },
  { value: "yaml", label: "YAML" },
  { value: "sql", label: "SQL" },
  { value: "bash", label: "Bash/Shell" },
  { value: "markdown", label: "Markdown" },
  { value: "merustmar", label: "Merustmar" },
] as const;

export type ThemeName =
  | "dark-plus"
  | "dracula"
  | "github-dark"
  | "github-light"
  | "nord"
  | "poimandres"
  | "min-light"
  | "min-dark"
  | "monokai"
  | "solarized-dark"
  | "solarized-light"
  | "andromeeda"
  | "aurora-x"
  | "catppuccin-latte"
  | "catppuccin-mocha"
  | "night-owl";

export const THEME_OPTIONS: { value: ThemeName; label: string }[] = [
  { value: "dark-plus", label: "Dark+" },
  { value: "dracula", label: "Dracula" },
  { value: "github-dark", label: "GitHub Dark" },
  { value: "github-light", label: "GitHub Light" },
  { value: "nord", label: "Nord" },
  { value: "poimandres", label: "Poimandres" },
  { value: "min-dark", label: "Min Dark" },
  { value: "min-light", label: "Min Light" },
  { value: "monokai", label: "Monokai" },
  { value: "solarized-dark", label: "Solarized Dark" },
  { value: "solarized-light", label: "Solarized Light" },
  { value: "andromeeda", label: "Andromeeda" },
  { value: "aurora-x", label: "Aurora X" },
  { value: "catppuccin-mocha", label: "Catppuccin Mocha" },
  { value: "catppuccin-latte", label: "Catppuccin Latte" },
  { value: "night-owl", label: "Night Owl" },
];

export interface Slide {
  id: string;
  code: string;
  language: string;
  duration: number;
  transitionDuration: number;
  stagger: number;
  orderIndex?: number;
}

export interface ProjectSettings {
  showLineNumbers: boolean;
  fontSize: number;
  lineHeight: number;
  editorFontSize: number;
  useGlobalTransition: boolean;
  globalTransitionDuration: number;
  useGlobalStagger: boolean;
  globalStagger: number;
  currentSlideId: string | null;
}

export interface Project {
  id: string;
  name: string;
  theme: ThemeName | string;
  settings: ProjectSettings;
  slides: Slide[];
  createdAt: number;
  updatedAt: number;
}

export interface ProjectSummary {
  id: string;
  name: string;
  theme: string;
  slideCount: number;
  createdAt: number;
  updatedAt: number;
}

export function themeBackground(theme: string): string {
  switch (theme) {
    case "github-light":
      return "#ffffff";
    case "dracula":
      return "#282a36";
    case "github-dark":
      return "#24292e";
    case "nord":
      return "#2e3440";
    case "poimandres":
      return "#1b1e28";
    case "min-light":
      return "#ffffff";
    case "min-dark":
      return "#1f1f1f";
    case "monokai":
      return "#272822";
    case "solarized-dark":
      return "#002b36";
    case "solarized-light":
      return "#fdf6e3";
    case "andromeeda":
      return "#23262e";
    case "aurora-x":
      return "#07090f";
    case "catppuccin-latte":
      return "#eff1f5";
    case "catppuccin-mocha":
      return "#1e1e2e";
    case "night-owl":
      return "#011627";
    case "dark-plus":
    default:
      return "#1e1e1e";
  }
}

export const LIGHT_THEMES = new Set([
  "github-light",
  "min-light",
  "solarized-light",
  "catppuccin-latte",
]);
