#!/usr/bin/env node
/**
 * Bundles the save-race regression suite (React 19 + react-query + zustand
 * running in jsdom, with `lib/tauri-api` / `lib/toast` swapped for manual
 * mocks) using the repo's esbuild, then runs it with node's test runner.
 *
 * - Everything is bundled except jsdom (dynamic require — not bundleable).
 *   IMPORTANT: react/react-dom are bundled on purpose. Externals evaluate
 *   before the bundle body — and react-dom inspects `window`/`document` at
 *   module-evaluation time (feature detection of the event system), while
 *   jsdom-env.mts installs those globals in the bundle body. Bundling
 *   react-dom keeps module evaluation topological (env first), which is
 *   what the probes proved necessary — with react-dom external, synthetic
 *   input events silently never reach onChange.
 * - The mock plugin resolves `tauri-api` / `toast` imports to tests/mocks/*
 *   before any other resolution rule can see them.
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync } from "node:fs";
import { build } from "esbuild";

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
  jsx: "automatic",
  alias: { "@": join(repo, "src") },
  plugins: [mockPlugin],
  logLevel: "warning",
});

// --test-force-exit: react-dom's scheduler holds a jsdom MessageChannel
// whose ports otherwise keep the event loop alive after the last test.
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
