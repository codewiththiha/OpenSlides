import {
  createHighlighter,
  type BundledLanguage,
  type BundledTheme,
  type Highlighter,
} from "shiki";
import { merustmarLanguage } from "./merustmar-language";

const DEFAULT_SHIKI_THEME = "dark-plus";
const DEFAULT_SHIKI_LANGUAGE = "typescript";

export function createShikiLoader() {
  let highlighterPromise: Promise<Highlighter> | null = null;
  const themeLoads = new Map<string, Promise<void>>();
  const langLoads = new Map<string, Promise<void>>();

  function getBase(): Promise<Highlighter> {
    if (!highlighterPromise) {
      highlighterPromise = createHighlighter({
        themes: [DEFAULT_SHIKI_THEME],
        langs: [DEFAULT_SHIKI_LANGUAGE],
      });
    }
    return highlighterPromise;
  }

  function ensureTheme(h: Highlighter, theme: string): Promise<void> {
    if (h.getLoadedThemes().includes(theme)) return Promise.resolve();
    let load = themeLoads.get(theme);
    if (!load) {
      load = h
        .loadTheme(theme as BundledTheme)
        .then(() => undefined)
        .finally(() => themeLoads.delete(theme));
      themeLoads.set(theme, load);
    }
    return load;
  }

  function ensureLanguage(h: Highlighter, language: string): Promise<void> {
    if (h.getLoadedLanguages().includes(language)) return Promise.resolve();
    let load = langLoads.get(language);
    if (!load) {
      load = (
        language === "merustmar"
          ? h.loadLanguage(merustmarLanguage)
          : h.loadLanguage(language as BundledLanguage)
      )
        .then(() => undefined)
        .finally(() => langLoads.delete(language));
      langLoads.set(language, load);
    }
    return load;
  }

  async function getHighlighter(
    theme: string,
    language: string,
  ): Promise<Highlighter> {
    const h = await getBase();
    await Promise.all([ensureTheme(h, theme), ensureLanguage(h, language)]);
    return h;
  }

  return { getHighlighter };
}
