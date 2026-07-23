#!/usr/bin/env node
/**
 * Bundles the present-flow app-level suite (real EditorInner mounted in
 * jsdom via scripts/lib/esbuild-svelte.mjs, with tauri-api swapped for the
 * full in-memory mock, shiki-instance mocked, and the @tauri-apps/api/*
 * runtime stubbed) using the repo's esbuild, then runs node --test.
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
      path: join(repo, "tests", "mocks", "tauri-api-full.mock.mts"),
    }));
    b.onResolve({ filter: /(^|\/)toast$/ }, () => ({
      path: join(repo, "tests", "mocks", "toast.mock.mts"),
    }));
    b.onResolve({ filter: /(^|\/)shiki-instance$/ }, () => ({
      path: join(repo, "tests", "mocks", "shiki-instance.mock.mts"),
    }));
    b.onResolve({ filter: /^@tauri-apps\/api\/(event|window|core)$/ }, () => ({
      path: join(repo, "tests", "mocks", "tauri-runtime.mock.mts"),
    }));
  },
};

await build({
  entryPoints: [
    join(repo, "tests", "present-flow.test.mts"),
    join(repo, "tests", "app-flow.test.mts"),
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
    join(outDir, "present-flow.test.mjs"),
    join(outDir, "app-flow.test.mjs"),
  ],
  { stdio: "inherit" },
);
