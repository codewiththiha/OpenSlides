/**
 * Singleton Shiki highlighter.
 * Both the code editor and slide preview share one WASM instance.
 *
 * NOTE: merustmar language registration is intentional and must stay.
 * Do not edit merustmar-language.ts.
 */
import { createHighlighter, type Highlighter } from "shiki";
import { SUPPORTED_LANGUAGES } from "../types";
import { merustmarLanguage } from "./merustmar-language";

const THEMES = [
  "dark-plus",
  "dracula",
  "github-dark",
  "github-light",
  "nord",
  "poimandres",
  "min-light",
  "min-dark",
  "monokai",
  "solarized-dark",
  "solarized-light",
  "andromeeda",
  "aurora-x",
  "catppuccin-latte",
  "catppuccin-mocha",
  "night-owl",
] as const;

let highlighterPromise: Promise<Highlighter> | null = null;

export function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = (async () => {
      const builtInLangs = SUPPORTED_LANGUAGES.filter(
        (l) => l.value !== "merustmar",
      ).map((l) => l.value);

      const h = await createHighlighter({
        themes: [...THEMES],
        langs: builtInLangs,
      });

      try {
        await h.loadLanguage(merustmarLanguage);
      } catch (err) {
        console.error("[OpenSlides] merustmar loadLanguage failed:", err);
      }

      return h;
    })();
  }
  return highlighterPromise;
}
