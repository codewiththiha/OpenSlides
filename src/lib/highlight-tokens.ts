/**
 * Structured-token highlight pipeline — the single data path for highlight
 * planning. Replaces the old Rust HTML-slicing backend (src-tauri highlight.rs,
 * since deleted): highlighters now yield TOKEN LINES with raw (unescaped)
 * string content, selections are sliced on those strings with plain JS indices
 * (UTF-16 — same as textarea.selectionStart), and HTML escaping happens at
 * RENDER time. The entire historical bug class is impossible by construction
 * here: no mid-entity cuts (entities are produced after slicing), no tag
 * balancing (tags are produced after slicing), no sparse/dense line desync
 * (lines are structural, code.split("\n"), not inferred from HTML).
 *
 * Semantics are an exact port of the deleted Rust implementation
 * (build_plan / decompose / selection_to_range / snippets / mix_toward_black) —
 * regression-locked by scripts/test-highlight.mjs against the same fixtures
 * and quirk outputs the Rust tests asserted.
 */

/** HTML-escape for rendered fragments: `&`, `<`, `>`, `"` — exactly the set
 *  both predecessors used (the frozen merustmar `esc` and the deleted Rust
 *  `escape_html`), keeping rendered output byte-identical to before. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ----------------------------------------------------------------------- *
 * DTOs
 * ----------------------------------------------------------------------- */

/** 0-based line/char span over the raw code (chars = JS string indices). */
export interface SelectionRange {
  startLine: number;
  startChar: number;
  endLine: number;
  endChar: number;
}

/** One styled run of raw text. `fontStyle` uses Shiki's bitflags
 *  (1 = italic, 2 = bold, 4 = underline); Merustmar tokens never set it. */
export interface HighlightToken {
  content: string;
  color?: string;
  bgColor?: string;
  fontStyle?: number;
}

export type HighlightTokenLine = HighlightToken[];

export interface HighlightPlanLine {
  /** 0-based index of this line in the source code. */
  lineIndex: number;
  /** Clamped selection bounds (UTF-16 units) inside this line. */
  startChar: number;
  endChar: number;
  /** Syntax-colored HTML for the clone (rendered AFTER slicing). */
  html: string;
  plainText: string;
  /** Nothing selected on this line — skip erase/clone, keep the entry. */
  isEmpty: boolean;
}

export interface HighlightPlan {
  lines: HighlightPlanLine[];
  /** Dimmed-card color the eraser boxes must paint. */
  eraserColor: string;
  selectedText: string;
}

/** Per-line clamped selection span (output of `decompose`). */
export interface LineRange {
  lineIndex: number;
  start: number;
  end: number;
}

/* ----------------------------------------------------------------------- *
 * Range math (exact ports of the deleted Rust functions)
 * ----------------------------------------------------------------------- */

/** Split a range into clamped per-line spans — one entry per covered line
 *  (an entry per line, including empty middle lines with start === end). */
export function decompose(code: string, range: SelectionRange): LineRange[] {
  const codeLines = code.split("\n");
  const total = codeLines.length;
  const clampI = (v: number, lo: number, hi: number) =>
    Math.min(Math.max(v, lo), hi);
  const startLine = clampI(range.startLine, 0, total - 1);
  const endLine = clampI(range.endLine, startLine, total - 1);

  const out: LineRange[] = [];
  for (let i = startLine; i <= endLine; i++) {
    const lineLen = codeLines[i].length; // JS length = UTF-16 units ✓
    const rawStart = i === startLine ? range.startChar : 0;
    const rawEnd = i === endLine ? range.endChar : Number.MAX_SAFE_INTEGER;
    const start = clampI(rawStart, 0, lineLen);
    const end = clampI(rawEnd, start, lineLen);
    out.push({ lineIndex: i, start, end });
  }
  return out;
}

/** Flat UTF-16 offset → line/char (`line` = # of "\n" before offset,
 *  `char` = offset − (position of last "\n" + 1)). */
function offsetToLineChar(code: string, offset: number) {
  const lim = Math.min(Math.max(offset, 0), code.length);
  let line = 0;
  let lastNl = -1;
  for (let i = 0; i < lim; i++) {
    if (code[i] === "\n") {
      line++;
      lastNl = i;
    }
  }
  return { line, char: lim - (lastNl + 1) };
}

/** Convert a flat [start, end) text selection into a line/char range. */
export function selectionToRange(
  code: string,
  start: number,
  end: number,
): SelectionRange {
  const lo = Math.min(start, end);
  const hi = Math.max(start, end);
  const s = offsetToLineChar(code, lo);
  const e = offsetToLineChar(code, hi);
  return {
    startLine: s.line,
    startChar: s.char,
    endLine: e.line,
    endChar: e.char,
  };
}

/* ----------------------------------------------------------------------- *
 * Token slicing & rendering (the heart of the refactor)
 * ----------------------------------------------------------------------- */

/** Slice the [start, end) window out of one line of tokens, splitting any
 *  token that straddles the window boundary. Pure string math. */
export function sliceTokenLine(
  tokens: HighlightTokenLine,
  start: number,
  end: number,
): HighlightTokenLine {
  const out: HighlightTokenLine = [];
  let offset = 0;
  for (const token of tokens) {
    const tokStart = offset;
    const tokEnd = offset + token.content.length;
    offset = tokEnd;
    const overlapStart = Math.max(start, tokStart);
    const overlapEnd = Math.min(end, tokEnd);
    if (overlapStart < overlapEnd) {
      out.push({
        ...token,
        content: token.content.slice(
          overlapStart - tokStart,
          overlapEnd - tokStart,
        ),
      });
    }
  }
  return out;
}

function tokenStyleAttr(token: HighlightToken): string {
  const decls: string[] = [];
  if (token.color) decls.push(`color:${token.color}`);
  if (token.bgColor) decls.push(`background-color:${token.bgColor}`);
  if (token.fontStyle) {
    if (token.fontStyle & 1) decls.push("font-style:italic");
    if (token.fontStyle & 2) decls.push("font-weight:bold");
    if (token.fontStyle & 4) decls.push("text-decoration:underline");
  }
  return decls.join(";");
}

/** Render (already-sliced) tokens to bare `<span>` HTML — escaping happens
 *  HERE, after slicing, so entities can never be cut mid-sequence. */
export function renderTokensToSpans(tokens: HighlightTokenLine): string {
  return tokens
    .map((t) => {
      const style = tokenStyleAttr(t);
      return style
        ? `<span style="${style}">${escapeHtml(t.content)}</span>`
        : `<span>${escapeHtml(t.content)}</span>`;
    })
    .join("");
}

/** Render full token lines with the `<span class="line">` wrapper the
 *  preview/measurer expects (magic-move uses `.line` per row too),
 *  lines joined by `\n`. */
export function renderTokenLines(lines: HighlightTokenLine[]): string {
  return lines
    .map((l) => `<span class="line">${renderTokensToSpans(l)}</span>`)
    .join("\n");
}

/* ----------------------------------------------------------------------- *
 * Color mixing & plan assembly (exact ports)
 * ----------------------------------------------------------------------- */

/** Dimmed-card color for the eraser boxes — mix the theme background
 *  toward black by dimPercent. 6-digit hex → `rgb(r, g, b)`; anything else
 *  passes through unchanged (same behavior as the deleted Rust mixer). */
export function mixTowardBlack(bg: string, dimPercent: number): string {
  const t = Math.min(Math.max(dimPercent, 0), 100) / 100;
  const hex = bg.trim().replace(/^#/, "");
  if (hex.length === 6 && /^[0-9a-fA-F]{6}$/.test(hex)) {
    const channel = (i: number) =>
      Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - t));
    return `rgb(${channel(0)}, ${channel(2)}, ${channel(4)})`;
  }
  return bg;
}

/** Build the full render plan for one highlight: per-line clamped char
 *  ranges + slice-rendered clone HTML + plain text + eraser color.
 *  `tokenLines === null` is the plain-fallback path (mirrors the old
 *  `html: ""` signal — the clone still shows, just uncolored). */
export function buildPlan(
  code: string,
  tokenLines: HighlightTokenLine[] | null,
  range: SelectionRange,
  themeBg: string,
  dimPercent: number,
): HighlightPlan {
  const codeLines = code.split("\n");
  const spans = decompose(code, range);

  const lines: HighlightPlanLine[] = [];
  const selectedParts: string[] = [];

  for (const lr of spans) {
    const rawLine = codeLines[lr.lineIndex];
    const plain = rawLine.slice(lr.start, lr.end);
    const isEmpty = lr.start >= lr.end;

    let sliceHtml = "";
    if (!isEmpty) {
      const tokenLine = tokenLines?.[lr.lineIndex];
      if (tokenLine && tokenLine.length > 0) {
        sliceHtml = renderTokensToSpans(
          sliceTokenLine(tokenLine, lr.start, lr.end),
        );
      }
      if (sliceHtml.trim() === "") {
        sliceHtml = escapeHtml(plain);
      }
    }
    selectedParts.push(plain);

    lines.push({
      lineIndex: lr.lineIndex,
      startChar: lr.start,
      endChar: lr.end,
      html: sliceHtml,
      plainText: plain,
      isEmpty,
    });
  }

  return {
    lines,
    eraserColor: mixTowardBlack(themeBg, dimPercent),
    selectedText: selectedParts.join("\n"),
  };
}

/** Plain-text snippet for each range (highlight settings panel rows) */
export function sliceSnippets(
  code: string,
  ranges: SelectionRange[],
): string[] {
  const codeLines = code.split("\n");
  return ranges.map((r) =>
    decompose(code, r)
      .map((lr) => codeLines[lr.lineIndex].slice(lr.start, lr.end))
      .join("\n"),
  );
}

/** Plain-fallback token lines (uncolored single token per line). */
export function plainTokenLines(code: string): HighlightTokenLine[] {
  return code.split("\n").map((l) => [{ content: l }]);
}

/**
 * Token lines for Merustmar — Rust IPC + Shiki worker handle 99.9% cases.
 * Previously used frozen JS fallback with complex HTML regex parser (merustmarHtmlToTokens),
 * now removed as dead weight. Falls back to plain tokens (monochrome) — exact content,
 * colored via worker when available.
 */
export function merustmarFallbackTokens(code: string, _isDark?: boolean): HighlightTokenLine[] {
  return plainTokenLines(code);
}
