/**
 * Core domain types for OpenSlides desktop.
 * Persistent data is owned by the Rust/SQLite backend;
 * these types mirror the IPC JSON contracts.
 */

export type CodeAlign = "left" | "center";

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

export interface Highlight {
  id: string;
  /** 0-based start line */
  startLine: number;
  /** 0-based start character within startLine */
  startChar: number;
  /** 0-based end line */
  endLine: number;
  /** 0-based end character within endLine */
  endChar: number;
  /** Dim amount for non-selected text (0-100). */
  dimAmount: number;
  /** Whether to scale up the selected text. */
  sizeUpEnabled: boolean;
  /** Scale-up amount in percent (100 = unchanged, 125 = default pop). */
  sizeUpAmount: number;
  /** Use custom transition durations (otherwise uses defaults). */
  useCustomTransition: boolean;
  /** Dim animation duration in ms. */
  dimTransition: number;
  /** Scale-up animation duration in ms. */
  sizeUpTransition: number;
}

export interface Slide {
  id: string;
  code: string;
  /** Mirrored from project settings for UI convenience / export. */
  language: string;
  duration: number;
  transitionDuration: number;
  stagger: number;
  orderIndex?: number;
  /** User-facing title; empty falls back to "Slide N" in UI. */
  name?: string;
  /** Highlight effects (sub-slide focus indicators). */
  highlights: Highlight[];
  /** Cached truncated Shiki HTML for the slide-strip thumbnail. */
  thumbnailHtml?: string;
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
  /** Project-wide language (source of truth). */
  language: string;
  /**
   * Position of the code *block* on the stage.
   * - left: block grows from the left (default)
   * - center: whole block is centered like CodeSlides (not text-align)
   */
  codeAlign: CodeAlign;
}

/** Single source of truth for highlight defaults; mirrors Rust serde defaults. */
export const HIGHLIGHT_DEFAULTS = {
  dimAmount: 75,
  sizeUpEnabled: true,
  sizeUpAmount: 125,
  useCustomTransition: false,
  dimTransition: 500,
  sizeUpTransition: 600,
} as const;

export interface Project {
  id: string;
  name: string;
  /** Database-sourced theme id; input APIs use ThemeName. */
  theme: string;
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
  language: string;
  firstSlideId: string;
  firstSlideCode: string;
  firstSlideThumbnail: string;
}

export function slideDisplayName(slide: Slide, index: number): string {
  const n = slide.name?.trim();
  return n || `Slide ${index + 1}`;
}

/**
 * The language used to highlight this project's code.
 * Project settings are the source of truth; the first slide is a legacy
 * fallback from when language was per-slide.
 */
export function resolveProjectLanguage(project: Project): string {
  return (
    project.settings.language ||
    project.slides[0]?.language ||
    "typescript"
  );
}

const THEME_BG = new Map<string, string>([
  ["github-light", "#ffffff"],
  ["dracula", "#282a36"],
  ["github-dark", "#24292e"],
  ["nord", "#2e3440"],
  ["poimandres", "#1b1e28"],
  ["min-light", "#ffffff"],
  ["min-dark", "#1f1f1f"],
  ["monokai", "#272822"],
  ["solarized-dark", "#002b36"],
  ["solarized-light", "#fdf6e3"],
  ["andromeeda", "#23262e"],
  ["aurora-x", "#07090f"],
  ["catppuccin-latte", "#eff1f5"],
  ["catppuccin-mocha", "#1e1e2e"],
  ["night-owl", "#011627"],
  ["dark-plus", "#1e1e1e"],
]);

export function themeBackground(theme: string): string {
  return THEME_BG.get(theme) ?? "#1e1e1e";
}

export const LIGHT_THEMES = new Set([
  "github-light",
  "min-light",
  "solarized-light",
  "catppuccin-latte",
]);
