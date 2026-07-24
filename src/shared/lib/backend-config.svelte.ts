import {
  FALLBACK_SUPPORTED_LANGUAGES,
  type LanguageOption,
} from "./language-meta";
import { THEMES as FALLBACK_THEMES, type ThemeMeta } from "./theme-meta";

/**
 * Runtime-backed frontend config cache.
 *
 * The backend is the source of truth for supported languages/themes and for
 * reset-to-default settings. These fallbacks keep the browser/dev/test contexts
 * usable before the Tauri bootstrap fetch lands (or when it never can).
 */
export interface DefaultProjectSettingsSnapshot {
  showLineNumbers: boolean;
  useBlackCodeBackground: boolean;
  showHighlightStepIndicator: boolean;
  fontSize: number;
  lineHeight: number;
  editorFontSize: number;
  useGlobalTransition: boolean;
  globalTransitionDuration: number;
  useGlobalStagger: boolean;
  globalStagger: number;
  useGlobalHighlight: boolean;
  globalDimAmount: number;
  globalSizeUpAmount: number;
  highlightDimColor: "black" | "theme";
  currentSlideId: string | null;
  language: string;
  codeAlign: "left" | "center";
}

function cloneLanguages(options: readonly LanguageOption[]): LanguageOption[] {
  return options.map((option) => ({ ...option }));
}

function cloneThemes(options: readonly ThemeMeta[]): ThemeMeta[] {
  return options.map((option) => ({ ...option }));
}

let languageOptions = $state<LanguageOption[]>(
  cloneLanguages(FALLBACK_SUPPORTED_LANGUAGES),
);
let themeOptionsState = $state<ThemeMeta[]>(cloneThemes(FALLBACK_THEMES));
let defaultProjectSettingsState = $state<DefaultProjectSettingsSnapshot | null>(
  null,
);

export function supportedLanguageOptions(): LanguageOption[] {
  return languageOptions;
}

export function supportedThemeOptions(): ThemeMeta[] {
  return themeOptionsState;
}

export function cachedDefaultProjectSettings(): DefaultProjectSettingsSnapshot | null {
  return defaultProjectSettingsState;
}

export function setSupportedLanguageOptions(
  options: readonly LanguageOption[],
) {
  languageOptions = options.length
    ? cloneLanguages(options)
    : cloneLanguages(FALLBACK_SUPPORTED_LANGUAGES);
}

export function setSupportedThemeOptions(options: readonly ThemeMeta[]) {
  themeOptionsState = options.length
    ? cloneThemes(options)
    : cloneThemes(FALLBACK_THEMES);
}

export function setDefaultProjectSettings(
  settings: DefaultProjectSettingsSnapshot,
) {
  defaultProjectSettingsState = { ...settings };
}
