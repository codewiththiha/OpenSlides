/**
 * useHighlightPlan — compute the render plan for the active highlight step.
 *
 * Fully client-side now (no IPC hop): highlighters yield token lines with
 * raw string content, then `buildPlan` does the selection slicing + clone
 * rendering synchronously. Sources:
 *   1. Shiki — `codeToTokensBase` (sync, WASM lives in JS),
 *   2. Merustmar — Rust `merustmar_tokens` command (async; frozen JS HTML
 *      converted to tokens as the failure fallback),
 *   3. anything else — plain uncolored tokens.
 *
 * Runs once per highlight activation (not per frame).
 */
import { useEffect, useState } from "react";
import type { BundledLanguage, BundledTheme, Highlighter } from "shiki";
import type { Highlight } from "@/types";
import { LIGHT_THEMES, themeBackground } from "@/types";
import { api } from "@/lib/tauri-api";
import {
  buildPlan,
  merustmarFallbackTokens,
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

/** Token lines for the current slide, from whichever highlighter applies. */
async function getTokenLines(
  code: string,
  highlighter: Highlighter | null,
  language: string,
  theme: string,
): Promise<HighlightTokenLine[]> {
  if (highlighter?.getLoadedLanguages().includes(language)) {
    try {
      const themeFg = highlighter.getTheme(theme).fg;
      // Resolve a token's missing color to the theme foreground so the clone
      // is self-contained (the shiki <pre> it overlays inherits it, the
      // floating clone cannot).
      return highlighter
        // Language/theme come from project settings (runtime strings); the
        // loaded-language check above guarantees shiki can resolve them.
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
    } catch {
      /* fall through to the merustmar/plain path */
    }
  }
  if (language === "merustmar") {
    const isDark = !LIGHT_THEMES.has(theme);
    try {
      return await api.merustmarTokens(code, isDark);
    } catch {
      // Frozen JS fallback (kept per repo policy) if IPC fails.
      return merustmarFallbackTokens(code, isDark);
    }
  }
  return plainTokenLines(code);
}

export function useHighlightPlan({
  highlight,
  code,
  highlighter,
  theme,
  language,
}: UseHighlightPlanArgs): HighlightPlan | null {
  // Tracked with the highlight id it was computed for: when stepping A → B,
  // A's plan must never render under B (a one-frame mismatch would flash A's
  // erasers at B's position), so non-matching entries are reported as null.
  const [entry, setEntry] = useState<{ id: string; plan: HighlightPlan } | null>(
    null,
  );

  useEffect(() => {
    if (!highlight) {
      setEntry(null);
      return;
    }
    let stale = false;
    const { id, startLine, startChar, endLine, endChar } = highlight;
    void (async () => {
      const tokenLines = code
        ? await getTokenLines(code, highlighter, language, theme)
        : null;
      if (stale) return;
      try {
        const plan = buildPlan(
          code,
          tokenLines,
          { startLine, startChar, endLine, endChar },
          themeBackground(theme),
          highlight.dimAmount ?? 75,
        );
        if (!stale) setEntry({ id, plan });
      } catch {
        if (!stale) setEntry(null);
      }
    })();
    return () => {
      stale = true;
    };
  }, [highlight, code, highlighter, language, theme]);

  return highlight && entry?.id === highlight.id ? entry.plan : null;
}
