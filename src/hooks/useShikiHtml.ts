import { useEffect, useRef, useState } from "react";
import { requestHtml } from "@/lib/shiki-worker-client";

interface UseShikiHtmlArgs {
  code: string;
  language: string;
  theme: string;
  /** Clears retained HTML when an editor/slide identity changes. */
  resetKey?: string;
  debounceMs?: number;
  priority?: "high" | "low";
  enabled?: boolean;
}

export function useShikiHtml({
  code,
  language,
  theme,
  resetKey = "",
  debounceMs = 80,
  priority = "high",
  enabled = true,
}: UseShikiHtmlArgs): string | null {
  const lastRef = useRef<string | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const activeKeyRef = useRef("");
  const htmlKeyRef = useRef("");
  const activeKey = `${resetKey}\u0000${language}\u0000${theme}`;

  // A reset key represents a different document. Do not render its previous
  // document's retained worker HTML during the next request.
  if (activeKeyRef.current !== activeKey) {
    activeKeyRef.current = activeKey;
    lastRef.current = null;
  }

  useEffect(() => {
    if (!enabled || !code || code.length > 20_000) {
      lastRef.current = null;
      htmlKeyRef.current = activeKey;
      setHtml(null);
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
          // Large code deliberately has no highlighted overlay. Keeping the
          // previous document here would display stale syntax content.
          if ((error as Error)?.message === "code_too_large" && activeKeyRef.current === activeKey) {
            lastRef.current = null;
            htmlKeyRef.current = activeKey;
            setHtml(null);
          }
        });
    }, actualDebounce);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [code, language, theme, activeKey, debounceMs, priority, enabled]);

  // Retain the last render only for the same document and theme. This avoids
  // typing flicker without showing another slide's code during a transition.
  if (!enabled || !code || code.length > 20_000 || htmlKeyRef.current !== activeKey) return null;
  return html ?? lastRef.current;
}
