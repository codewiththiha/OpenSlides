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

let highlighterPromise: Promise<Highlighter> | null = null;

function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = (async () => {
      const h = await createHighlighter({
        themes: ["dark-plus"],
        langs: ["typescript"],
      });
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
const ABORTED_MAX = 64; // bounded LRU — prevents unbounded growth if aborts arrive while sync codeToHtml busy

function addAborted(id: number) {
  abortedIds.add(id);
  if (abortedIds.size > ABORTED_MAX) {
    // Delete oldest half (Set preserves insertion order)
    const it = abortedIds.values();
    const toDelete = Math.floor(ABORTED_MAX / 2);
    for (let i = 0; i < toDelete; i++) {
      const v = it.next().value;
      if (v !== undefined) abortedIds.delete(v);
    }
    if (abortedIds.size > ABORTED_MAX) {
      // Fallback: clear all if still too large (should not happen)
      abortedIds.clear();
    }
  }
}

function isAborted(id: number): boolean {
  return abortedIds.has(id);
}

self.onmessage = async (e: MessageEvent<WorkerIncoming>) => {
  const data = e.data as any;

  // Handle abort signal from main thread — bounded set prevents memory growth
  if (data?.type === "abort" && typeof data.id === "number") {
    const abortId = data.id as number;
    addAborted(abortId);
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

  // Guard huge files: Shiki codeToHtml is O(n) and can monopolize the worker on large inputs
  // Let main thread fallback to plain monochrome (no IPC error, just fast path)
  if (code.length > 20_000) {
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

    if (!highlighter.getLoadedThemes().includes(theme)) {
      try { await highlighter.loadTheme(theme as any); } catch { /* report below */ }
      if (isAborted(id)) {
        abortedIds.delete(id);
        (self as any).postMessage({ id, aborted: true } as WorkerResponse);
        return;
      }
    }
    if (!highlighter.getLoadedLanguages().includes(lang)) {
      try {
        if (lang === "merustmar") await highlighter.loadLanguage(merustmarLanguage as any);
        else await highlighter.loadLanguage(lang as any);
      } catch { /* report below */ }
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
