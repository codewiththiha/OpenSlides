/**
 * Shiki Web Worker — offload tokenization off main thread.
 * Previously CodeEditor ran codeToHtml synchronously on every keystroke (2-5ms blocking).
 * Now all Shiki work happens here.
 */

import { createHighlighter, type Highlighter } from "shiki";
import { merustmarLanguage } from "@/lib/merustmar-language";

// Themes — must match shiki-instance.ts
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

// Lightweight language list without merustmar (we load custom separately)
const BUILTIN_LANGS = [
  "typescript",
  "javascript",
  "tsx",
  "jsx",
  "python",
  "java",
  "go",
  "rust",
  "php",
  "css",
  "html",
  "json",
  "yaml",
  "sql",
  "bash",
  "markdown",
] as const;

let highlighterPromise: Promise<Highlighter> | null = null;

function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = (async () => {
      const h = await createHighlighter({
        themes: [...THEMES],
        langs: [...BUILTIN_LANGS],
      });
      try {
        // @ts-ignore - merustmar custom grammar
        await h.loadLanguage(merustmarLanguage as any);
      } catch (e) {
        console.error("[Shiki Worker] merustmar load failed", e);
      }
      return h;
    })();
  }
  return highlighterPromise;
}

export interface WorkerRequest {
  id: number;
  code: string;
  lang: string;
  theme: string;
}

export interface WorkerResponse {
  id: number;
  html?: string;
  error?: string;
}

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const { id, code, lang, theme } = e.data;

  // Early exit for huge files to avoid worker Jank — let main choose fallback
  // (20k char budget similar to old sync, but now off main thread)
  if (code.length > 50_000) {
    // Still try but warn; we let main thread cap if needed
  }

  try {
    const highlighter = await getHighlighter();

    const loaded = highlighter.getLoadedLanguages();
    if (!loaded.includes(lang)) {
      // Try to load on demand if not built-in (best effort)
      try {
        // @ts-ignore dynamic load attempt
        await highlighter.loadLanguage(lang as any);
      } catch {
        // ignore, will fall back
      }
    }

    const html = highlighter.codeToHtml(code, {
      lang: lang as any,
      theme: theme as any,
    });

    // Extract inner <code>...</code> to match previous API (pre already exists)
    const match = html.match(/<code[^>]*>([\s\S]*?)<\/code>/);
    const inner = match ? match[1] : html;

    const response: WorkerResponse = { id, html: inner };
    (self as any).postMessage(response);
  } catch (err) {
    const response: WorkerResponse = {
      id,
      error: err instanceof Error ? err.message : String(err),
    };
    (self as any).postMessage(response);
  }
};
