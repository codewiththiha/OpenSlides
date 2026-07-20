/** Shared Shiki worker hook for the editor HTML overlay. */
import { useEffect, useRef, useState } from "react";
import { requestHtml } from "@/lib/shiki-worker-client";

const DEBOUNCE_MS = 80;

interface Args {
  code: string;
  language: string;
  theme: string;
}

export function useShikiWorker({ code, language, theme }: Args): string | null {
  const lastRef = useRef<string | null>(null);
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      requestHtml(code, language, theme, controller.signal)
        .then((response) => {
          if (controller.signal.aborted || !response.html) return;
          lastRef.current = response.html;
          setHtml(response.html);
        })
        .catch((error) => {
          if ((error as DOMException)?.name === "AbortError") return;
          // Keep the last successful markup visible on worker/language errors.
        });
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [code, language, theme]);

  return html ?? lastRef.current;
}
