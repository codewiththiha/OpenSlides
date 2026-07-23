/**
 * Minimal esbuild plugin for mounting real Svelte 5 components in the jsdom
 * test suites — precompiles `.svelte` components (with the compiler's native
 * TypeScript support) and `.svelte.js`/`.svelte.ts` rune modules. Replaces
 * the React-era jsx wiring in the test runners.
 */
import { readFileSync } from "node:fs";
import { dirname } from "node:path";
import { transformSync } from "esbuild";
import { compile, compileModule } from "svelte/compiler";

export function sveltePlugin() {
  return {
    name: "esbuild-svelte5",
    setup(b) {
      b.onLoad({ filter: /\.svelte$/ }, (args) => {
        const source = readFileSync(args.path, "utf8");
        const { js } = compile(source, {
          filename: args.path,
          generate: "client",
          css: "injected",
        });
        return {
          contents: js.code,
          loader: "js",
          resolveDir: dirname(args.path),
        };
      });
      b.onLoad({ filter: /\.svelte\.(js|ts)$/ }, (args) => {
        let source = readFileSync(args.path, "utf8");
        if (args.path.endsWith(".ts")) {
          // compileModule parses JS only — vite-plugin-svelte relies on
          // Vite's esbuild pass to strip TS first (post-enforce), so we do
          // the same here with esbuild's own transformer.
          source = transformSync(source, {
            loader: "ts",
            format: "esm",
            sourcefile: args.path,
          }).code;
        }
        const { js } = compileModule(source, {
          filename: args.path,
          generate: "client",
        });
        return {
          contents: js.code,
          loader: "js",
          resolveDir: dirname(args.path),
        };
      });
    },
  };
}

/** Resolution conditions mirroring what Vite applies in the app build. */
export const SVELTE_CONDITIONS = [
  "svelte",
  "browser",
  "module",
  "import",
  "default",
];
