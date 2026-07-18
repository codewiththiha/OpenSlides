#!/usr/bin/env node
/**
 * Bundles the highlight-token regression suite (TS, imports from src/) with
 * the repo's esbuild, then runs it with node's built-in test runner.
 * No additional dev-dependencies required.
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(repo, ".cache-tests", "highlight-tokens.test.mjs");

execFileSync(
  join(repo, "node_modules", ".bin", "esbuild"),
  [
    join(repo, "tests", "highlight-tokens.test.mts"),
    "--bundle",
    "--format=esm",
    "--platform=node",
    `--outfile=${out}`,
    "--log-level=warning",
  ],
  { stdio: "inherit" },
);

execFileSync(process.execPath, ["--test", out], { stdio: "inherit" });
