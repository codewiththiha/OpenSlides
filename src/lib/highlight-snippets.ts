import { sliceSnippets, type SelectionRange } from "@/lib/highlight-tokens";
import type { Highlight } from "@/types";

/**
 * Plain-text snippet per highlight (settings panel rows).
 * React wrapped this sync string op in React Query, then useMemo — in Svelte
 * it's just a function consumed through `$derived` at the call site.
 */
export function highlightSnippets(code: string, highlights: Highlight[]): string[] {
  const ranges: SelectionRange[] = highlights.map(
    ({ startLine, startChar, endLine, endChar }) => ({
      startLine,
      startChar,
      endLine,
      endChar,
    }),
  );
  return sliceSnippets(code, ranges);
}
