/**
 * Utility functions for highlight mode.
 * Handles text position calculation, range extraction, and DOM measurement.
 */
import type { Highlight } from "@/types";

/** Generate a simple unique ID for highlights */
export function generateHighlightId(): string {
  return `hl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Default values for a new highlight */
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
    dimAmount: 75,
    sizeUpEnabled: true,
    useCustomTransition: false,
    dimTransition: 500,
    sizeUpTransition: 600,
  };
}

/**
 * Extract the selected text from code given a highlight range.
 * Works with the raw code string.
 */
export function extractHighlightText(
  code: string,
  highlight: Highlight,
): string {
  const lines = code.split("\n");
  if (highlight.startLine === highlight.endLine) {
    const line = lines[highlight.startLine] ?? "";
    return line.slice(highlight.startChar, highlight.endChar);
  }
  const result: string[] = [];
  for (let i = highlight.startLine; i <= highlight.endLine; i++) {
    const line = lines[i] ?? "";
    if (i === highlight.startLine) {
      result.push(line.slice(highlight.startChar));
    } else if (i === highlight.endLine) {
      result.push(line.slice(0, highlight.endChar));
    } else {
      result.push(line);
    }
  }
  return result.join("\n");
}

/**
 * Extract the lines of code that contain the highlight.
 * Returns the full lines (not truncated).
 */
export function extractHighlightLines(
  code: string,
  highlight: Highlight,
): string[] {
  const lines = code.split("\n");
  return lines.slice(highlight.startLine, highlight.endLine + 1);
}

/**
 * Calculate the pixel position of a highlight range within a monospace code block.
 * Uses character width and line height for precise positioning.
 */
export function calculateHighlightPosition(
  container: HTMLElement,
  highlight: Highlight,
  charWidth: number,
  lineHeight: number,
  paddingTop: number,
  paddingLeft: number,
): { x: number; y: number; width: number; height: number } {
  const numLines = highlight.endLine - highlight.startLine + 1;

  // Calculate width: for single line, it's (endChar - startChar) * charWidth
  // For multi-line, it's the max width of any line in the range
  let maxWidth: number;
  if (numLines === 1) {
    maxWidth = (highlight.endChar - highlight.startChar) * charWidth;
  } else {
    // Multi-line: width is from startChar to end of first line, then full lines, then to endChar
    // We use the max of the first line's remainder and last line's end
    const codeLines = container.closest("[data-code-container]")?.getAttribute("data-code")?.split("\n") ?? [];
    const firstLineWidth = ((codeLines[highlight.startLine]?.length ?? 0) - highlight.startChar) * charWidth;
    const lastLineWidth = highlight.endChar * charWidth;
    maxWidth = Math.max(firstLineWidth, lastLineWidth);
    // Also consider middle lines
    for (let i = highlight.startLine + 1; i < highlight.endLine; i++) {
      const w = (codeLines[i]?.length ?? 0) * charWidth;
      if (w > maxWidth) maxWidth = w;
    }
  }

  const x = paddingLeft + highlight.startChar * charWidth;
  const y = paddingTop + highlight.startLine * lineHeight;
  const height = numLines * lineHeight;

  return { x, y, width: Math.max(maxWidth, charWidth), height };
}

/**
 * Get the center point of a highlight's bounding area.
 * Used as transform-origin for scale-up animation.
 */
export function getHighlightCenter(
  pos: { x: number; y: number; width: number; height: number },
): { cx: number; cy: number } {
  return {
    cx: pos.x + pos.width / 2,
    cy: pos.y + pos.height / 2,
  };
}

/**
 * Measure character width in a given container by creating a test element.
 */
export function measureCharWidth(
  container: HTMLElement,
  fontSize: number,
  fontFamily: string,
): number {
  const test = document.createElement("span");
  test.style.position = "absolute";
  test.style.visibility = "hidden";
  test.style.whiteSpace = "pre";
  test.style.fontSize = `${fontSize}px`;
  test.style.fontFamily = fontFamily;
  test.style.lineHeight = "1";
  test.textContent = "xxxxxxxxxx"; // 10 x's for accuracy
  container.appendChild(test);
  const width = test.getBoundingClientRect().width / 10;
  container.removeChild(test);
  return width;
}

/**
 * Build an HTML string for the highlighted text range with proper syntax colors.
 * This takes the full Shiki-rendered HTML and extracts just the highlight range.
 */
export function extractHighlightedHtml(
  fullHtml: string,
  highlight: Highlight,
): string {
  // Parse the HTML to find line spans
  const parser = new DOMParser();
  const doc = parser.parseFromString(
    `<div>${fullHtml}</div>`,
    "text/html",
  );
  const root = doc.body.firstElementChild;
  if (!root) return "";

  // Find all line elements - shiki renders each line as a span
  // ShikiMagicMove uses individual character spans, but regular Shiki uses line spans
  const lines = root.querySelectorAll(".line, [data-line]");

  if (lines.length === 0) {
    // Fallback: treat the entire HTML as a single block
    // Split by newlines
    const allLines = fullHtml.split("\n");
    const selected = allLines.slice(
      highlight.startLine,
      highlight.endLine + 1,
    );
    return selected.join("\n");
  }

  const result: string[] = [];
  for (let i = highlight.startLine; i <= highlight.endLine; i++) {
    const lineEl = lines[i];
    if (!lineEl) continue;

    const lineHtml = lineEl.innerHTML;
    if (i === highlight.startLine && i === highlight.endLine) {
      // Single line: extract character range
      result.push(extractCharRange(lineHtml, highlight.startChar, highlight.endChar));
    } else if (i === highlight.startLine) {
      result.push(extractCharRange(lineHtml, highlight.startChar, -1));
    } else if (i === highlight.endLine) {
      result.push(extractCharRange(lineHtml, 0, highlight.endChar));
    } else {
      result.push(lineHtml);
    }
  }

  return result.join("\n");
}

/**
 * Extract a character range from an HTML string while preserving tags.
 * Counts only visible characters (not HTML tags).
 */
function extractCharRange(html: string, start: number, end: number): string {
  let charIndex = 0;
  let inTag = false;
  let result = "";
  let capturing = false;

  for (let i = 0; i < html.length; i++) {
    const ch = html[i];

    if (ch === "<") {
      inTag = true;
      if (capturing) result += ch;
      continue;
    }
    if (ch === ">") {
      inTag = false;
      if (capturing) result += ch;
      continue;
    }
    if (inTag) {
      if (capturing) result += ch;
      continue;
    }

    // Visible character
    if (charIndex >= start && (end === -1 || charIndex < end)) {
      if (!capturing) {
        // Start capturing: include any open tags we need
        capturing = true;
      }
      result += ch;
    }

    charIndex++;

    if (end !== -1 && charIndex >= end && !inTag) {
      break;
    }
  }

  return result;
}
