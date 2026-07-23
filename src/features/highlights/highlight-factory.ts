import { HIGHLIGHT_DEFAULTS, type Highlight } from "$lib/types";

function generateHighlightId() {
  return `hl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createDefaultHighlight(
  startLine: number,
  startChar: number,
  endLine: number,
  endChar: number,
): Highlight {
  return {
    id: generateHighlightId(),
    startLine,
    startChar,
    endLine,
    endChar,
    ...HIGHLIGHT_DEFAULTS,
  };
}
