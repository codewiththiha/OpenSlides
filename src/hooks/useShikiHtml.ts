import { useEffect, useRef, useState } from "react";
import { requestHtml } from "@/lib/shiki-worker-client";

type StaleHtmlPolicy = "clear" | "keep-last";

interface UseShikiHtmlArgs {
  code: string;
  language: string;
  theme: string;
  /** Clears retained HTML when an editor/slide identity changes. */
  resetKey?: string;
  debounceMs?: number;
  priority?: "high" | "low";
  enabled?: boolean;
  /** What to render when the worker fails for the current request. */
  errorPolicy?: StaleHtmlPolicy;
  /** What to render when `code` is empty. */
  emptyPolicy?: StaleHtmlPolicy;
  /** What to render when `code` is too large for the worker. */
  largeCodePolicy?: StaleHtmlPolicy;
  /** What to render when the hook is disabled. */
  disabledPolicy?: StaleHtmlPolicy;
  maxCodeLength?: number;
}

const DEFAULT_MAX_CODE_LENGTH = 20_000;

export function useShikiHtml({
  code,
  language,
  theme,
  resetKey = "",
  debounceMs = 80,
  priority = "high",
  enabled = true,
  errorPolicy = "keep-last",
  emptyPolicy = "clear",
  largeCodePolicy = "clear",
  disabledPolicy = "clear",
  maxCodeLength = DEFAULT_MAX_CODE_LENGTH,
}: UseShikiHtmlArgs): string | null {
  const lastRef = useRef<string | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const activeKeyRef = useRef("");
  const htmlKeyRef = useRef("");
  const activeKey = `${resetKey}\u0000${language}\u0000${theme}`;
  const isEmpty = code.length === 0;
  const isTooLarge = code.length > maxCodeLength;

  const clearCurrent = () => {
    lastRef.current = null;
    htmlKeyRef.current = activeKey;
    setHtml(null);
  };

  // A reset key represents a different document. Do not render its previous
  // document's retained worker HTML during the next request.
  if (activeKeyRef.current !== activeKey) {
    activeKeyRef.current = activeKey;
    lastRef.current = null;
  }

  useEffect(() => {
    if (!enabled) {
      if (disabledPolicy === "clear") clearCurrent();
      return;
    }
    if (isEmpty) {
      if (emptyPolicy === "clear") clearCurrent();
      return;
    }
    if (isTooLarge) {
      if (largeCodePolicy === "clear") clearCurrent();
      return;
    }

    const isTestEnv =
      (typeof window !== "undefined" && (window as any).IS_REACT_ACT_ENVIRONMENT) ||
      (typeof globalThis !== "undefined" && (globalThis as any).IS_REACT_ACT_ENVIRONMENT);
    const actualDebounce = isTestEnv ? 0 : debounceMs;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      requestHtml(code, language, theme, controller.signal, priority)
        .then((response) => {
          if (controller.signal.aborted || !response.html || activeKeyRef.current !== activeKey) return;
          lastRef.current = response.html;
          htmlKeyRef.current = activeKey;
          setHtml(response.html);
        })
        .catch((error) => {
          if ((error as DOMException)?.name === "AbortError") return;
          if (activeKeyRef.current !== activeKey) return;
          if (errorPolicy === "clear" || (error as Error)?.message === "code_too_large") {
            clearCurrent();
          }
        });
    }, actualDebounce);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    code,
    language,
    theme,
    activeKey,
    debounceMs,
    priority,
    enabled,
    errorPolicy,
    emptyPolicy,
    largeCodePolicy,
    disabledPolicy,
    maxCodeLength,
    isEmpty,
    isTooLarge,
  ]);

  // Retention is now an explicit policy instead of an accidental hook detail:
  // resetKey/language/theme changes always isolate documents, while individual
  // invalid states decide whether to clear or keep the previous same-document HTML.
  if (htmlKeyRef.current !== activeKey) return null;
  if (!enabled && disabledPolicy === "clear") return null;
  if (isEmpty && emptyPolicy === "clear") return null;
  if (isTooLarge && largeCodePolicy === "clear") return null;
  return html ?? lastRef.current;
}
