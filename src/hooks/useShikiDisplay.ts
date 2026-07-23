import { useShikiHighlighterDisplay } from "./useShikiDisplayState.svelte";

interface UseShikiDisplayArgs {
  theme: string;
  language: string;
}

/**
 * Backwards-compatible facade for MagicMove/highlighter display state.
 * The authoritative loading/error/fallback policy lives in useShikiDisplayState.
 */
export function useShikiDisplay(args: () => UseShikiDisplayArgs) {
  return useShikiHighlighterDisplay(() => ({
    ...args(),
    policyName: "magicMove",
  }));
}
