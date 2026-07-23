#!/usr/bin/env node
/**
 * Bundles the save-race / editor-typing regression suites (real Svelte 5
 * components mounted in jsdom via scripts/lib/esbuild-svelte.mjs, with
 * `lib/tauri-api` / `lib/toast` / `lib/shiki-instance` swapped for manual
 * mocks) using the repo's esbuild, then runs them with node's test runner.
 *
 * - Everything is bundled except jsdom (dynamic require — not bundleable).
 * - The mock plugin resolves `tauri-api` / `toast` / `shiki-instance`
 *   imports to tests/mocks/* before any other resolution rule can see them.
 * - `.svelte` components and `.svelte.js`/`.svelte.ts` rune modules are
 *   precompiled with svelte/compiler (native TS support) — no React, no jsx.
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync } from "node:fs";
import { build } from "esbuild";
import { sveltePlugin, SVELTE_CONDITIONS } from "./lib/esbuild-svelte.mjs";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(repo, ".cache-tests");
mkdirSync(outDir, { recursive: true });
const mockPlugin = {
  name: "mock-tauri-ipc",
  setup(b) {
    b.onResolve({ filter: /(^|\/)tauri-api$/ }, () => ({
      path: join(repo, "tests", "mocks", "tauri-api.mock.mts"),
    }));
    b.onResolve({ filter: /(^|\/)toast$/ }, () => ({
      path: join(repo, "tests", "mocks", "toast.mock.mts"),
    }));
    b.onResolve({ filter: /(^|\/)shiki-instance$/ }, () => ({
      path: join(repo, "tests", "mocks", "shiki-instance.mock.mts"),
    }));
  },
};

await build({
  entryPoints: [
    join(repo, "tests", "editor-save-race.test.mts"),
    join(repo, "tests", "codeeditor-typing.test.mts"),
    join(repo, "tests", "highlight-utils-cache.test.mts"),
    join(repo, "tests", "editor-history.test.mts"),
  ],
  outdir: outDir,
  outExtension: { ".js": ".mjs" },
  bundle: true,
  format: "esm",
  platform: "node",
  external: ["jsdom"],
  loader: { ".mts": "tsx" },
  alias: {
    "@": join(repo, "src"),
    $lib: join(repo, "src", "shared"),
  },
  conditions: SVELTE_CONDITIONS,
  plugins: [mockPlugin, sveltePlugin()],
  logLevel: "warning",
});

// --test-force-exit: jsdom globals and timer chains can hold the event loop
// alive after the last test.
execFileSync(
  process.execPath,
  [
    "--test",
    "--test-force-exit",
    join(outDir, "editor-save-race.test.mjs"),
    join(outDir, "codeeditor-typing.test.mjs"),
    join(outDir, "highlight-utils-cache.test.mjs"),
    join(outDir, "editor-history.test.mjs"),
  ],
  { stdio: "inherit" },
);
