/** Shared Shiki worker hook for the editor HTML overlay. */
import { useShikiHtml } from "./useShikiHtml";

interface Args {
  code: string;
  language: string;
  theme: string;
  resetKey?: string;
}

export function useShikiWorker({ code, language, theme, resetKey }: Args): string | null {
  return useShikiHtml({
    code,
    language,
    theme,
    resetKey,
    debounceMs: 80,
    priority: "high",
    errorPolicy: "clear",
    emptyPolicy: "clear",
    largeCodePolicy: "clear",
  });
}
