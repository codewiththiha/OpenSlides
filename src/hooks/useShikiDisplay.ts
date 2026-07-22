import { useShikiHighlighterDisplay } from "./useShikiDisplayState";

interface UseShikiDisplayArgs {
  theme: string;
  language: string;
}

/**
 * Backwards-compatible facade for MagicMove/highlighter display state.
 * The authoritative loading/error/fallback policy lives in useShikiDisplayState.
 */
export function useShikiDisplay({ theme, language }: UseShikiDisplayArgs) {
  return useShikiHighlighterDisplay({
    theme,
    language,
    policyName: "magicMove",
  });
}
