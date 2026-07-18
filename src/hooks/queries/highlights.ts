import { useQuery } from "@tanstack/react-query";
import { api, type SelectionRange } from "../../lib/tauri-api";
import type { Highlight } from "../../types";

/**
 * Plain-text snippet per highlight (settings panel rows), sliced in Rust.
 * Keyed by the ranges themselves so edits recompute; previous data is kept
 * while refetching so rows never flash an empty state.
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
    queryFn: () => api.highlightSnippets(code, ranges),
    placeholderData: (previous) => previous,
    staleTime: 30_000,
  });
}
