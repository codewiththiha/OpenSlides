/** Singleton Shiki highlighter with lazy theme/language loading. */
import { createHighlighter, type BundledLanguage, type BundledTheme, type Highlighter } from "shiki";
import { merustmarLanguage } from "./merustmar-language";

let highlighterPromise: Promise<Highlighter> | null = null;
const themeLoads = new Map<string, Promise<void>>();
const langLoads = new Map<string, Promise<void>>();

function getBaseHighlighter() {
  if (!highlighterPromise) highlighterPromise = createHighlighter({ themes: ["dark-plus"], langs: ["typescript"] });
  return highlighterPromise;
}

function ensureTheme(h: Highlighter, theme: string): Promise<void> {
  if (h.getLoadedThemes().includes(theme)) return Promise.resolve();
  let load = themeLoads.get(theme);
  if (!load) {
    load = h.loadTheme(theme as BundledTheme).then(() => undefined).finally(() => themeLoads.delete(theme));
    themeLoads.set(theme, load);
  }
  return load;
}

function ensureLanguage(h: Highlighter, language: string): Promise<void> {
  if (h.getLoadedLanguages().includes(language)) return Promise.resolve();
  let load = langLoads.get(language);
  if (!load) {
    load = (language === "merustmar" ? h.loadLanguage(merustmarLanguage) : h.loadLanguage(language as BundledLanguage))
      .then(() => undefined).finally(() => langLoads.delete(language));
    langLoads.set(language, load);
  }
  return load;
}

export async function getHighlighter(theme: string, language: string): Promise<Highlighter> {
  const h = await getBaseHighlighter();
  await ensureTheme(h, theme);
  await ensureLanguage(h, language);
  return h;
}
