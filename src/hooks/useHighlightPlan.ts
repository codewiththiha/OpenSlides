/**
 * useHighlightPlan — compute render plan for active highlight step.
 * Now with AbortController to cancel stale Shiki/Rust work and direct plainTokenLines fallback.
 */
import { useEffect, useState } from "react";
import type { BundledLanguage, BundledTheme, Highlighter } from "shiki";
import type { Highlight } from "@/types";
import { themeBackground } from "@/types";
import {
  buildPlan,
  plainTokenLines,
  type HighlightPlan,
  type HighlightTokenLine,
} from "@/lib/highlight-tokens";

interface UseHighlightPlanArgs {
  highlight: Highlight | null;
  code: string;
  highlighter: Highlighter | null;
  theme: string;
  language: string;
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

export function useHighlightPlan({
  highlight,
  code,
  highlighter,
  theme,
  language,
}: UseHighlightPlanArgs): HighlightPlan | null {
  const [entry, setEntry] = useState<{ id: string; plan: HighlightPlan } | null>(null);

  useEffect(() => {
    if (!highlight) {
      setEntry(null);
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
        const plan = buildPlan(
          code,
          tokenLines,
          { startLine, startChar, endLine, endChar },
          themeBackground(theme),
          highlight.dimAmount ?? 75,
        );
        if (!signal.aborted) setEntry({ id, plan });
      } catch (err) {
        if ((err as DOMException)?.name === "AbortError") return;
        if (!signal.aborted) setEntry(null);
      }
    })();

    return () => {
      controller.abort();
    };
  }, [highlight, code, highlighter, language, theme]);

  return highlight && entry?.id === highlight.id ? entry.plan : null;
}
