/**
 * useHighlightPlan — compute the Rust-side render plan for the active
 * highlight step.
 *
 * The entire data path runs in one async effect, off the render path:
 *   1. highlighted HTML — Shiki (sync, WASM lives in JS) or Merustmar
 *      (Rust IPC, frozen JS as failure fallback),
 *   2. `api.computeHighlightPlan` — line splitting of the emitted HTML,
 *      entity-aware char slicing, range decomposition, eraser color mixing.
 *
 * Runs once per highlight activation (not per frame — Rust state, not per
 * render either, so stepping slides never blocks the main thread).
 */
import { useEffect, useState } from "react";
import type { Highlighter } from "shiki";
import type { Highlight } from "@/types";
import { LIGHT_THEMES, themeBackground } from "@/types";
import { api, type HighlightPlan } from "@/lib/tauri-api";
import { highlightMerustmarCode } from "@/lib/merustmar-highlight";

interface UseHighlightPlanArgs {
  highlight: Highlight | null;
  code: string;
  highlighter: Highlighter | null;
  theme: string;
  language: string;
}

/** Render `code` to highlighted HTML (Shiki, or Merustmar in Rust). */
async function renderCodeHtml(
  code: string,
  highlighter: Highlighter | null,
  language: string,
  theme: string,
): Promise<string> {
  if (highlighter?.getLoadedLanguages().includes(language)) {
    try {
      return highlighter.codeToHtml(code, { lang: language, theme });
    } catch {
      /* fall through to the merustmar/plain path */
    }
  }
  if (language === "merustmar") {
    try {
      return await api.merustmarHighlightCode(code, !LIGHT_THEMES.has(theme));
    } catch {
      // Frozen JS fallback (kept per repo policy) if IPC fails.
      return highlightMerustmarCode(code, !LIGHT_THEMES.has(theme));
    }
  }
  return "";
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
      // "" signals the plain-text fallback path inside computeHighlightPlan.
      const html = code
        ? await renderCodeHtml(code, highlighter, language, theme)
        : "";
      if (stale) return;
      try {
        const plan = await api.computeHighlightPlan({
          code,
          html,
          range: { startLine, startChar, endLine, endChar },
          themeBg: themeBackground(theme),
          dimPercent: highlight.dimAmount ?? 75,
        });
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
