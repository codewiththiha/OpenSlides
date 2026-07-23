import {
  useShikiDisplayHtml,
  type ShikiDisplayHtmlArgs,
} from "./useShikiDisplayState.svelte";

/** Shared Shiki worker hook for the editor HTML overlay. */
export function useShikiWorker(
  args: () => Pick<ShikiDisplayHtmlArgs, "code" | "language" | "theme" | "resetKey">,
) {
  return useShikiDisplayHtml(() => ({
    ...args(),
    debounceMs: 80,
    priority: "high",
    policyName: "editor",
  }));
}
