/**
 * createHighlightPlan — compute render plan for active highlight step.
 * AbortController cancels stale Shiki work; direct plainTokenLines fallback.
 */
import type { BundledLanguage, BundledTheme, Highlighter } from "shiki";
import type { Highlight } from "$lib/types";
import {
  buildPlan,
  plainTokenLines,
  type HighlightPlan,
  type HighlightTokenLine,
} from "@/features/highlights/highlight-tokens";

interface UseHighlightPlanArgs {
  highlight: () => Highlight | null;
  code: () => string;
  highlighter: () => Highlighter | null;
  theme: () => string;
  language: () => string;
}

async function getTokenLines(
  code: string,
  highlighter: Highlighter | null,
  language: string,
  theme: string,
  signal?: AbortSignal,
): Promise<HighlightTokenLine[]> {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

  if (highlighter?.getLoadedLanguages().includes(language)) {
    try {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const themeFg = highlighter.getTheme(theme).fg;
      const tokens = highlighter
        .codeToTokensBase(code, {
          lang: language as BundledLanguage,
          theme: theme as BundledTheme,
        })
        .map((line) =>
          line.map((t) => ({
            content: t.content,
            color: t.color ?? themeFg,
            bgColor: t.bgColor,
            fontStyle: t.fontStyle,
          })),
        );
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      return tokens;
    } catch (err) {
      if ((err as DOMException)?.name === "AbortError") throw err;
    }
  }

  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  return plainTokenLines(code);
}

export function createHighlightPlan(args: UseHighlightPlanArgs) {
  let entry = $state<{ id: string; plan: HighlightPlan } | null>(null);

  $effect(() => {
    const highlight = args.highlight();
    const code = args.code();
    const highlighter = args.highlighter();
    const theme = args.theme();
    const language = args.language();

    if (!highlight) {
      entry = null;
      return;
    }

    const controller = new AbortController();
    const { signal } = controller;
    const { id, startLine, startChar, endLine, endChar } = highlight;

    void (async () => {
      try {
        const tokenLines = code
          ? await getTokenLines(code, highlighter, language, theme, signal)
          : null;
        if (signal.aborted) return;
        const plan = buildPlan(code, tokenLines, {
          startLine,
          startChar,
          endLine,
          endChar,
        });
        if (!signal.aborted) entry = { id, plan };
      } catch (err) {
        if ((err as DOMException)?.name === "AbortError") return;
        if (!signal.aborted) entry = null;
      }
    })();

    return () => {
      controller.abort();
    };
  });

  return {
    get plan() {
      const highlight = args.highlight();
      return highlight && entry?.id === highlight.id ? entry.plan : null;
    },
  };
}
