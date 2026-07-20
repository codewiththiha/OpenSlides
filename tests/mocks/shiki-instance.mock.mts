/**
 * Mock of src/lib/shiki-instance for the jsdom suites. Replaces the heavy
 * WASM highlighter with a synchronous fake that mirrors the contract the
 * editor relies on: colored markup whose text content EXACTLY equals the
 * source (entity-escaped). The custom `merustmar` grammar is included in the
 * loaded set, matching the real shiki-instance contract.
 */

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const LOADED = [
  "rust",
  "javascript",
  "typescript",
  "python",
  "go",
  "json",
  "toml",
  "yaml",
  "merustmar",
];

const MARKER = "#7ee787"; // proves "colored" in assertions

export function getHighlighter(): Promise<{
  getLoadedLanguages: () => string[];
  codeToHtml: (src: string, opts: { lang: string; theme: string }) => string;
}> {
  return Promise.resolve({
    getLoadedLanguages: () => [...LOADED],
    codeToHtml: (src, opts) => {
      if (!LOADED.includes(opts.lang)) throw new Error("not loaded");
      // One colored span per line, mirroring shiki's <pre><code> shape.
      const lines = src
        .split("\n")
        .map(
          (l) =>
            `<span class="line"><span style="color:${MARKER}">${esc(l)}</span></span>`,
        )
        .join("\n");
      return `<pre class="shiki"><code>${lines}</code></pre>`;
    },
  });
}

export { MARKER as SHIKI_MOCK_COLOR };
