import { useEffect, useRef, useState } from "react";
import { requestHtml } from "@/lib/shiki-worker-client";

interface UseShikiHtmlArgs {
  code: string;
  language: string;
  theme: string;
  debounceMs?: number;
  priority?: "high" | "low";
  enabled?: boolean;
}

export function useShikiHtml({
  code,
  language,
  theme,
  debounceMs = 80,
  priority = "high",
  enabled = true,
}: UseShikiHtmlArgs): string | null {
  const lastRef = useRef<string | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const envRef = useRef("");
  const envKey = `${language}\u0000${theme}`;
  if (envRef.current !== envKey) {
    envRef.current = envKey;
    lastRef.current = null;
  }

  useEffect(() => {
    if (!enabled || !code) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      requestHtml(code, language, theme, controller.signal, priority)
        .then((response) => {
          if (controller.signal.aborted || !response.html) return;
          lastRef.current = response.html;
          setHtml(response.html);
        })
        .catch((error) => {
          if ((error as DOMException)?.name === "AbortError") return;
          // Keep last successful markup on worker/language errors.
        });
    }, debounceMs);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [code, language, theme, debounceMs, priority, enabled]);

  return html ?? lastRef.current;
}
