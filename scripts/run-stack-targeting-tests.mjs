#!/usr/bin/env node
/**
 * Bundles the stack-targeting unit tests (pure TS, imports from src/) with
 * the repo's esbuild, then runs them with node's built-in test runner.
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(repo, ".cache-tests", "stack-targeting.test.mjs");

execFileSync(
  join(repo, "node_modules", ".bin", "esbuild"),
  [
    join(repo, "tests", "stack-targeting.test.mts"),
    "--bundle",
    "--format=esm",
    "--platform=node",
    `--outfile=${out}`,
    "--log-level=warning",
  ],
  { stdio: "inherit" },
);

execFileSync(process.execPath, ["--test", out], { stdio: "inherit" });
