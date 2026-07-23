/** Singleton Shiki highlighter with lazy theme/language loading. */
import type { Highlighter } from "shiki";
import { createShikiLoader } from "./shiki-loader";

const loader = createShikiLoader();

export function getHighlighter(
  theme: string,
  language: string,
): Promise<Highlighter> {
  return loader.getHighlighter(theme, language);
}
