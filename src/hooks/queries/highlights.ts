import { useMemo } from "react";
import { sliceSnippets, type SelectionRange } from "../../lib/highlight-tokens";
import type { Highlight } from "../../types";

/**
 * Plain-text snippet per highlight (settings panel rows).
 * Previously wrapped sync sliceSnippets in React Query (cache key, state machine, re-render).
 * Now plain useMemo — synchronous string op cheaper than Query overhead.
 */
export function useHighlightSnippets(code: string, highlights: Highlight[]) {
  return useMemo(() => {
    const ranges: SelectionRange[] = highlights.map(
      ({ startLine, startChar, endLine, endChar }) => ({
        startLine,
        startChar,
        endLine,
        endChar,
      }),
    );
    return sliceSnippets(code, ranges);
  }, [code, highlights]);
}
