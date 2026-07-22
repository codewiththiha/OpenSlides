/** Shared Shiki worker hook for the editor HTML overlay. */
import { useShikiDisplayHtml } from "./useShikiDisplayState";

interface Args {
  code: string;
  language: string;
  theme: string;
  resetKey?: string;
}

export function useShikiWorker({ code, language, theme, resetKey }: Args): string | null {
  return useShikiDisplayHtml({
    code,
    language,
    theme,
    resetKey,
    debounceMs: 80,
    priority: "high",
    policyName: "editor",
  }).html;
}
