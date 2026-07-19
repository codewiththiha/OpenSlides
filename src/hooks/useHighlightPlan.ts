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
 *
 * Fix: AbortController for rapid highlight clicks.
 * - Previously a stale boolean flag ignored result but underlying work continued.
 * - Now we create an AbortController per effect, pass signal to tokenization
 *   and Rust IPC, and abort on cleanup / highlight ID change.
 * - Shiki Worker and Rust IPC both respect the signal to free thread for current highlight.
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
  signal?: AbortSignal,
): Promise<HighlightTokenLine[]> {
  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }

  if (highlighter?.getLoadedLanguages().includes(language)) {
    try {
      // Check abort before expensive WASM work
      if (signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
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
      if (signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      return tokens;
    } catch (err) {
      if ((err as DOMException)?.name === "AbortError") throw err;
      /* fall through to the merustmar/plain path */
    }
  }
  if (language === "merustmar") {
    const isDark = !LIGHT_THEMES.has(theme);
    try {
      // Pass signal to Rust IPC — aborts underlying sqlx/LRU work via promise race
      return await api.merustmarTokens(code, isDark, signal);
    } catch (err) {
      if ((err as DOMException)?.name === "AbortError") throw err;
      // Frozen JS fallback if IPC fails or aborted after fallback started
      if (signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      return merustmarFallbackTokens(code, isDark);
    }
  }
  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
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

        if (!signal.aborted) {
          setEntry({ id, plan });
        }
      } catch (err) {
        if ((err as DOMException)?.name === "AbortError") {
          // Silently ignore aborted work — frees thread for current highlight
          return;
        }
        if (!signal.aborted) {
          setEntry(null);
        }
      }
    })();

    return () => {
      // Abort underlying Shiki tokenization / Rust IPC when highlight ID changes
      // or component unmounts — frees Worker thread for current highlight.
      controller.abort();
    };
  }, [highlight, code, highlighter, language, theme]);

  return highlight && entry?.id === highlight.id ? entry.plan : null;
}
