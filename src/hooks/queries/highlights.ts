import { useQuery } from "@tanstack/react-query";
import {
  sliceSnippets,
  type SelectionRange,
} from "../../lib/highlight-tokens";
import type { Highlight } from "../../types";

/**
 * Plain-text snippet per highlight (settings panel rows), sliced client-side
 * from the source string. Keyed by the ranges themselves so edits recompute;
 * previous data is kept while refetching so rows never flash an empty state.
 */
export function useHighlightSnippets(code: string, highlights: Highlight[]) {
  const ranges: SelectionRange[] = highlights.map(
    ({ startLine, startChar, endLine, endChar }) => ({
      startLine,
      startChar,
      endLine,
      endChar,
    }),
  );
  const rangesKey = ranges
    .map((r) => `${r.startLine}:${r.startChar}-${r.endLine}:${r.endChar}`)
    .join("|");

  return useQuery({
    queryKey: ["highlight-snippets", code, rangesKey],
    queryFn: () => Promise.resolve(sliceSnippets(code, ranges)),
    placeholderData: (previous) => previous,
    staleTime: 30_000,
  });
}
