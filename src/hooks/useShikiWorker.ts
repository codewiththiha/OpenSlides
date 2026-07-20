/** Shared Shiki worker hook for the editor HTML overlay. */
import { useShikiHtml } from "./useShikiHtml";

interface Args {
  code: string;
  language: string;
  theme: string;
}

export function useShikiWorker({ code, language, theme }: Args): string | null {
  return useShikiHtml({ code, language, theme, debounceMs: 80, priority: "high" });
}
