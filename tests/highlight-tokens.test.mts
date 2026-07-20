/**
 * Regression suite for the client-side structured-token highlight pipeline
 * (src/lib/highlight-tokens.ts). Replaces the deleted Rust tests
 * (src-tauri/src/highlight.rs) and locks every bug from the highlight saga:
 *
 *   1. multi-line erasure coverage (decompose emits one entry per line,
 *      INCLUDING empty middle lines with start === end),
 *   2. HTML-entity cutting (`&gt;` sliced mid-sequence) — impossible by
 *      construction now: escape-after-slice is asserted directly,
 *   3. sparse/dense line-index desync — lines are code.split("\n") structural,
 *
 * Run via: npm run test:highlight
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPlan,
  decompose,
  mixTowardBlack,
  plainTokenLines,
  renderTokensToSpans,
  selectionToRange,
  sliceSnippets,
  sliceTokenLine,
  type HighlightTokenLine,
} from "../src/lib/highlight-tokens.ts";

const rng = (startLine: number, startChar: number, endLine: number, endChar: number) => ({
  startLine, startChar, endLine, endChar,
});

/* Same fixture the deleted Rust tests used: lines have 31, 32, 0, 21 chars. */
const CODE =
  "console.error('Error:', error);\n" +
  "const xs = list.map(x => x + 1);\n" +
  "\n" +
  "if (a < b && c > d) {\n" +
  '  console.log("cmp");\n' +
  "}";

test("decompose: single line clamps to selection", () => {
  const d = decompose(CODE, rng(0, 14, 0, 22));
  assert.deepEqual(d, [{ lineIndex: 0, start: 14, end: 22 }]);
});

test("decompose: multi-line covers EVERY line incl. empty middle (saga bug #1)", () => {
  const d = decompose(CODE, rng(0, 8, 4, 6));
  assert.deepEqual(d, [
    { lineIndex: 0, start: 8, end: 31 },
    { lineIndex: 1, start: 0, end: 32 },
    { lineIndex: 2, start: 0, end: 0 }, // empty line: start === end
    { lineIndex: 3, start: 0, end: 21 },
    { lineIndex: 4, start: 0, end: 6 },
  ]);
});

test("decompose: out-of-bounds values are clamped to the code", () => {
  const d = decompose(CODE, rng(0, -5, 99, 99));
  assert.equal(d.length, 6);
  assert.deepEqual(d[0], { lineIndex: 0, start: 0, end: 31 });
  assert.deepEqual(d[5], { lineIndex: 5, start: 0, end: 1 });
});

test("sliceTokenLine: straddling tokens split at both boundaries", () => {
  const line: HighlightTokenLine = [
    { content: "const ", color: "#c678dd" },
    { content: "answer", color: "#e5c07b" },
    { content: " = 42;", color: "#abb2bf" },
  ];
  assert.deepEqual(sliceTokenLine(line, 4, 9), [
    { content: "t ", color: "#c678dd" },
    { content: "ans", color: "#e5c07b" },
  ]);
  assert.deepEqual(sliceTokenLine(line, 0, 999), line);
  assert.deepEqual(sliceTokenLine(line, 3, 3), []);
  assert.deepEqual(sliceTokenLine(line, 999, 1000), []);
  assert.deepEqual(sliceTokenLine([], 0, 5), []);
});

test("escape happens AFTER slicing — entity cutting is impossible (saga bug #2)", () => {
  // A window that would have cut "&gt;" mid-sequence in the HTML world:
  const line: HighlightTokenLine = [
    { content: "a < b ", color: "#abb2bf" },
    { content: "&&", color: "#56b6c2" },
    { content: ' c > "d"', color: "#abb2bf" },
  ];
  const sliced = sliceTokenLine(line, 2, 12);
  const html = renderTokensToSpans(sliced);
  assert.equal(
    html,
    '<span style="color:#abb2bf">&lt; b </span>' +
      '<span style="color:#56b6c2">&amp;&amp;</span>' +
      '<span style="color:#abb2bf"> c &gt;</span>',
  );
});

test("renderTokensToSpans: fontStyle bitflags + bgColor, colorless spans", () => {
  assert.equal(
    renderTokensToSpans([
      { content: "x", color: "#fff" , fontStyle: 1 },
      { content: "y", bgColor: "#222", fontStyle: 2 | 4 },
      { content: "z" },
    ]),
    '<span style="color:#fff;font-style:italic">x</span>' +
      '<span style="background-color:#222;font-weight:bold;text-decoration:underline">y</span>' +
      "<span>z</span>",
  );
});

test("buildPlan: dense entries over empty line (saga bug #3) + selectedText", () => {
  const tokens = CODE.split("\n").map((l) => [{ content: l, color: "#abb2bf" }]);
  const plan = buildPlan(CODE, tokens, rng(0, 8, 4, 6), "#1e1e1e", 75);
  assert.deepEqual(
    plan.lines.map((l) => [l.lineIndex, l.startChar, l.endChar, l.isEmpty]),
    [
      [0, 8, 31, false],
      [1, 0, 32, false],
      [2, 0, 0, true], // empty middle line: kept, flagged
      [3, 0, 21, false],
      [4, 0, 6, false],
    ],
  );
  assert.equal(plan.lines[2].html, "");
  assert.equal(
    plan.selectedText,
    "error('Error:', error);\nconst xs = list.map(x => x + 1);\n\nif (a < b && c > d) {\n  cons",
  );
});

test("buildPlan: null tokens → plain fallback (escaped, uncolored)", () => {
  const plan = buildPlan("a<b\ncde", null, rng(0, 0, 1, 2), "#000000", 75);
  assert.equal(plan.lines[0].html, "a&lt;b");
  assert.equal(plan.lines[1].html, "cd");
});

test("buildPlan: whitespace-only slice on a token line stays colored", () => {
  const tokens: HighlightTokenLine[] = [[{ content: "   ", color: "#abb2bf" }]];
  const plan = buildPlan("   ", tokens, rng(0, 0, 0, 2), "#000000", 75);
  assert.equal(plan.lines[0].html, '<span style="color:#abb2bf">  </span>');
});

test("buildPlan: eraser color mixes theme bg toward black", () => {
  const plan = buildPlan("x", plainTokenLines("x"), rng(0, 0, 0, 1), "#ff0000", 50);
  assert.equal(plan.eraserColor, "rgb(128, 0, 0)");
});

test("mixTowardBlack: ports the deleted Rust mixer semantics", () => {
  assert.equal(mixTowardBlack("#1e1e1e", 75), "rgb(8, 8, 8)"); // 30 × 0.25 = 7.5 → 8
  assert.equal(mixTowardBlack("#ff0000", 0), "rgb(255, 0, 0)");
  assert.equal(mixTowardBlack("#ff0000", 100), "rgb(0, 0, 0)");
  assert.equal(mixTowardBlack("#ff0000", 150), "rgb(0, 0, 0)"); // clamped
  assert.equal(mixTowardBlack("#ff0000", -5), "rgb(255, 0, 0)"); // clamped
  assert.equal(mixTowardBlack("#fff", 50), "#fff"); // non-6-digit passes through
  assert.equal(mixTowardBlack("rgb(1,2,3)", 50), "rgb(1,2,3)");
  assert.equal(mixTowardBlack("  #00ff00  ", 50), "rgb(0, 128, 0)"); // trimmed
});

test("selectionToRange: flat offsets (UTF-16) → line/char, order-normalized", () => {
  const code = "ab\ncd\nefg";
  assert.deepEqual(selectionToRange(code, 0, 0), rng(0, 0, 0, 0));
  assert.deepEqual(selectionToRange(code, 2, 3), rng(0, 2, 1, 0)); // across \n
  assert.deepEqual(selectionToRange(code, 4, 9), rng(1, 1, 2, 3));
  assert.deepEqual(selectionToRange(code, 9, 4), rng(1, 1, 2, 3)); // swapped
  assert.deepEqual(selectionToRange(code, 99, 99), rng(2, 3, 2, 3)); // clamp EOF
  // Astral chars count as 2 UTF-16 units (textarea semantics):
  assert.deepEqual(selectionToRange("😀\nx", 2, 3), rng(0, 2, 1, 0));
});

test("sliceSnippets: per-range plain text, clamped, \\n-joined", () => {
  assert.deepEqual(sliceSnippets(CODE, [rng(0, 8, 1, 5), rng(3, 0, 3, 2)]), [
    "error('Error:', error);\nconst",
    "if",
  ]);
  assert.deepEqual(sliceSnippets(CODE, [rng(0, -9, 99, 99)]), [
    CODE, // entire document clamped
  ]);
});
