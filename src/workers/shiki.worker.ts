/**
 * Shiki Web Worker — offload tokenization off main thread.
 * Previously CodeEditor ran codeToHtml synchronously on every keystroke (2-5ms blocking).
 * Now all Shiki work happens here.
 *
 * Enhancement: AbortController support for rapid highlight clicks.
 * - Main thread sends {type:'abort', id} when highlight ID changes.
 * - Worker tracks abortedIds set.
 * - Before/after expensive ops (highlighter load, codeToHtml), checks abort and skips.
 * - This frees Worker thread for current highlight instead of finishing stale work.
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

export interface WorkerAbort {
  type: "abort";
  id: number;
}

export type WorkerIncoming = WorkerRequest | WorkerAbort;

export interface WorkerResponse {
  id: number;
  html?: string;
  error?: string;
  aborted?: boolean;
}

const abortedIds = new Set<number>();

function isAborted(id: number): boolean {
  return abortedIds.has(id);
}

self.onmessage = async (e: MessageEvent<WorkerIncoming>) => {
  const data = e.data as any;

  // Handle abort signal from main thread
  if (data?.type === "abort" && typeof data.id === "number") {
    const abortId = data.id as number;
    abortedIds.add(abortId);
    // If currently processing this id, we can't interrupt synchronous codeToHtml mid-flight,
    // but we flag it so we skip posting result after.
    return;
  }

  // Normal tokenization request
  const { id, code, lang, theme } = data as WorkerRequest;

  if (typeof id !== "number") return;

  // If this request was already aborted before starting, skip entirely
  if (isAborted(id)) {
    abortedIds.delete(id);
    // Optionally notify main thread that it was aborted
    const abortedResponse: WorkerResponse = { id, aborted: true };
    (self as any).postMessage(abortedResponse);
    return;
  }

  // Guard huge files: Shiki codeToHtml is O(n) and can jank worker on 50k+ chars
  // Let main thread fallback to plain monochrome (no IPC error, just fast path)
  if (code.length > 50_000) {
    console.warn(`[Shiki Worker] code too large (${code.length} chars) — skipping highlight, using plain fallback`);
    (self as any).postMessage({ id, error: "code_too_large" } as WorkerResponse);
    return;
  }

  try {
    // Check abort before expensive highlighter acquisition
    if (isAborted(id)) {
      abortedIds.delete(id);
      (self as any).postMessage({ id, aborted: true } as WorkerResponse);
      return;
    }

    const highlighter = await getHighlighter();

    // Check abort after async highlighter load (could have been aborted during load)
    if (isAborted(id)) {
      abortedIds.delete(id);
      (self as any).postMessage({ id, aborted: true } as WorkerResponse);
      return;
    }

    const loaded = highlighter.getLoadedLanguages();
    if (!loaded.includes(lang)) {
      try {
        // @ts-ignore dynamic load attempt
        await highlighter.loadLanguage(lang as any);
      } catch {
        // ignore, will fall back
      }
      if (isAborted(id)) {
        abortedIds.delete(id);
        (self as any).postMessage({ id, aborted: true } as WorkerResponse);
        return;
      }
    }

    // This is the expensive synchronous part — check abort before starting
    if (isAborted(id)) {
      abortedIds.delete(id);
      (self as any).postMessage({ id, aborted: true } as WorkerResponse);
      return;
    }

    const html = highlighter.codeToHtml(code, {
      lang: lang as any,
      theme: theme as any,
    });

    // Check abort after tokenization, before posting
    if (isAborted(id)) {
      abortedIds.delete(id);
      (self as any).postMessage({ id, aborted: true } as WorkerResponse);
      return;
    }

    const match = html.match(/<code[^>]*>([\s\S]*?)<\/code>/);
    const inner = match ? match[1] : html;

    const response: WorkerResponse = { id, html: inner };
    (self as any).postMessage(response);
  } catch (err) {
    // If aborted, don't send error, send aborted flag
    if (isAborted(id)) {
      abortedIds.delete(id);
      (self as any).postMessage({ id, aborted: true } as WorkerResponse);
      return;
    }
    const response: WorkerResponse = {
      id,
      error: err instanceof Error ? err.message : String(err),
    };
    (self as any).postMessage(response);
  }
};
