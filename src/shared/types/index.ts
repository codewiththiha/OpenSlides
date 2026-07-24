/**
 * Core domain types for OpenSlides desktop.
 * Persistent data is owned by the Rust/SQLite backend;
 * these types mirror the IPC JSON contracts.
 */

type CodeAlign = "left" | "center";

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
  { value: "groovy", label: "Groovy" },
  { value: "css", label: "CSS" },
  { value: "html", label: "HTML" },
  { value: "json", label: "JSON" },
  { value: "yaml", label: "YAML" },
  { value: "sql", label: "SQL" },
  { value: "bash", label: "Bash/Shell" },
  { value: "markdown", label: "Markdown" },
  { value: "merustmar", label: "Merustmar" },
] as const;

export type { ThemeName } from "$lib/lib/theme-meta";

export {
  THEME_OPTIONS,
  themeBackground,
  fallbackForeground,
} from "$lib/lib/themes";

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
  /** Derived from project settings on read — export/API compatibility only.
   *  The per-slide DB column was dropped (migration v6). Never edit or
   *  display this directly; use resolveProjectLanguage(project).
   * @deprecated Use resolveProjectLanguage(project) instead.
   */
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
  /** Section/group ID if this slide is part of a slide stack. */
  sectionId?: string | null;
}

export interface ProjectSettings {
  showLineNumbers: boolean;
  /** Replace the syntax theme background with pure black for compositing. */
  useBlackCodeBackground: boolean;
  /** Show the floating highlight-step progress control on preview and presentation. */
  showHighlightStepIndicator: boolean;
  fontSize: number;
  lineHeight: number;
  editorFontSize: number;
  useGlobalTransition: boolean;
  globalTransitionDuration: number;
  useGlobalStagger: boolean;
  globalStagger: number;
  /** Global highlight pop-up size + dim controls (like stagger/transition) */
  useGlobalHighlight: boolean;
  globalDimAmount: number;
  globalSizeUpAmount: number;
  /** Dim background color for highlights: "black" or "theme" (theme's code background) */
  highlightDimColor: "black" | "theme";
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
  sizeUpAmount: 100,
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
  groupId?: string | null;
  groupOrder?: number;
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
    project.settings.language || project.slides[0]?.language || "typescript"
  );
}
