/**
 * useHighlightPlan — compute the Rust-side render plan for the active
 * highlight step.
 *
 * Shiki highlighting itself stays in JS (the WASM highlighter lives here),
 * but everything after it — line splitting of the emitted HTML, entity-aware
 * char slicing, range decomposition, eraser color mixing — runs natively via
 * `api.computeHighlightPlan`, once per highlight activation (not per frame).
 */
import { useEffect, useMemo, useState } from "react";
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

/** Render `code` to highlighted HTML (Shiki, or the Merustmar fallback). */
function renderCodeHtml(
  code: string,
  highlighter: Highlighter | null,
  language: string,
  theme: string,
): string {
  if (highlighter?.getLoadedLanguages().includes(language)) {
    try {
      return highlighter.codeToHtml(code, { lang: language, theme });
    } catch {
      /* fall through to the merustmar/plain path */
    }
  }
  if (language === "merustmar") {
    return highlightMerustmarCode(code, !LIGHT_THEMES.has(theme));
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

  // The highlighted HTML is only recomputed when the actual inputs change —
  // stepping between highlights on the same slide reuses it.
  const html = useMemo(() => {
    if (!highlight || !code) return "";
    return renderCodeHtml(code, highlighter, language, theme);
  }, [highlight, highlighter, code, language, theme]);

  useEffect(() => {
    if (!highlight) {
      setEntry(null);
      return;
    }
    let stale = false;
    const { id, startLine, startChar, endLine, endChar } = highlight;
    api
      .computeHighlightPlan({
        code,
        html,
        range: { startLine, startChar, endLine, endChar },
        themeBg: themeBackground(theme),
        dimPercent: highlight.dimAmount ?? 75,
      })
      .then((plan) => {
        if (!stale) setEntry({ id, plan });
      })
      .catch(() => {
        if (!stale) setEntry(null);
      });
    return () => {
      stale = true;
    };
  }, [highlight, code, html, theme]);

  return highlight && entry?.id === highlight.id ? entry.plan : null;
}
