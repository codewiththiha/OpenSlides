/**
 * Live end-to-end sanity: real Shiki tokenization + getTheme().fg +
 * buildPlan slicing over entity-bearing code. Run once during the refactor
 * (not part of npm scripts — requires shiki WASM load, ~1s).
 */
import { createHighlighter } from "shiki";
import { buildPlan } from "../src/lib/highlight-tokens.ts";

const h = await createHighlighter({
  themes: ["github-dark", "github-light"],
  langs: ["typescript"],
});

const CODE = `if (a < b && c > d) {
  const msg = "x & y";
  // tail comment
}`;

// 1. getTheme fg/bg present and sane
const theme = h.getTheme("github-dark");
if (!/^#[0-9a-f]{6}$/i.test(theme.fg) || !/^#[0-9a-f]{6}$/i.test(theme.bg)) {
  throw new Error(`getTheme missing fg/bg: ${theme.fg} / ${theme.bg}`);
}
console.log("theme fg/bg:", theme.fg, theme.bg);

// 2. codeToTokensBase line count matches code lines (sparse/dense, bug #3)
const raw = h.codeToTokensBase(CODE, {
  lang: "typescript",
  theme: "github-dark",
});
const codeLines = CODE.split("\n");
if (raw.length !== codeLines.length) {
  throw new Error(
    `token line split mismatch: ${raw.length} vs ${codeLines.length}`,
  );
}

// 3. Map to our token shape (same mapper as useHighlightPlan), colors resolved
const tokenLines = raw.map((line) =>
  line.map((t) => ({
    content: t.content,
    color: t.color ?? theme.fg,
    bgColor: t.bgColor,
    fontStyle: t.fontStyle,
  })),
);
// Every token content concatenation must reproduce the raw line exactly
raw.forEach((line, i) => {
  const joined = line.map((t) => t.content).join("");
  if (joined !== codeLines[i]) {
    throw new Error(`line ${i} content mismatch: ${JSON.stringify(joined)}`);
  }
});
console.log("token content round-trips the source per line ✓");

// 4. Plan a multi-line selection cutting through <, &&, " and a comment
const plan = buildPlan(
  CODE,
  tokenLines,
  { startLine: 0, startChar: 3, endLine: 2, endChar: 15 },
  theme.bg,
  75,
);
console.log("--- plan lines ---");
for (const l of plan.lines)
  console.log(l.lineIndex, `[${l.startChar},${l.endChar})`, l.html);
console.log(
  "eraser:",
  plan.eraserColor,
  "| selected:",
  JSON.stringify(plan.selectedText),
);

if (!plan.lines[0].html.includes("&lt;"))
  throw new Error("entity lost in clone (line 0)");
if (
  plan.lines[0].html.includes("&") &&
  /&(?!amp;|lt;|gt;|quot;)/.test(
    plan.lines[0].html.replace(/&amp;|&lt;|&gt;|&quot;/g, ""),
  )
) {
  throw new Error("raw & leaked into clone html");
}
if (!plan.lines[1].html.includes("&quot;"))
  throw new Error("quote entity lost in clone (line 1)");
if (plan.lines.length !== 3) throw new Error("plan line count wrong");
console.log("entity-safe multi-line clone ✓");

console.log("OK — live Shiki e2e passed");
