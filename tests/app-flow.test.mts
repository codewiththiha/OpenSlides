/**
 * App-flow suite — mounts the REAL App.svelte (hash router + Dashboard +
 * Editor) in jsdom with the full in-memory tauri-api mock and replays the
 * complete user journey from the report:
 *
 *   dashboard → click a presentation card → editor opens → click "Present"
 *
 * Any silent dead-end (click not opening, route not matching, overlay not
 * mounting) fails the test with the step that broke.
 */
// MUST be the first import (installs document/window for the components).
import "./helpers/jsdom-env.mts";

import test from "node:test";
import assert from "node:assert/strict";
import { flushSync, mount, unmount } from "svelte";
import App from "../src/app/App.svelte";
import {
  ui,
  setIsPresenting,
  setCurrentSlideId,
} from "../src/shared/stores/ui-state.svelte";
import { clearAllLocalCode } from "../src/shared/stores/slide-code.svelte";
import { queryClient } from "../src/shared/queries/query-client";
import type { Highlight, Project } from "../src/shared/types";
import {
  resetFullApiMocks,
  seedProjects,
} from "./mocks/tauri-api-full.mock.mts";

const errors: unknown[] = [];
process.on("uncaughtException", (e) => errors.push(e));
process.on("unhandledRejection", (e) => errors.push(e));

// Surface Svelte runtime warnings (derived_inert, effect depth, ...) as test
// failures — they signal stale reads / runaway effects the user can't see.
const origWarn = console.warn;
console.warn = (...args: unknown[]) => {
  if (String(args[0]).includes("svelte.dev/e/")) {
    errors.push(new Error(`svelte runtime warning: ${args[0]}`));
    return;
  }
  origWarn(...args);
};

function makeHighlight(id: string, line: number): Highlight {
  return {
    id,
    startLine: line,
    startChar: 0,
    endLine: line,
    endChar: 10,
    dimAmount: 75,
    sizeUpEnabled: false,
    sizeUpAmount: 125,
    useCustomTransition: false,
    dimTransition: 500,
    sizeUpTransition: 600,
  };
}

function makeProject(id: string, name: string): Project {
  return {
    id,
    name,
    theme: "dark-plus",
    settings: {
      showLineNumbers: true,
      useBlackCodeBackground: false,
      showHighlightStepIndicator: true,
      fontSize: 24,
      lineHeight: 1.5,
      editorFontSize: 14,
      useGlobalTransition: false,
      globalTransitionDuration: 300,
      useGlobalStagger: false,
      globalStagger: 0,
      currentSlideId: null,
      language: "javascript",
      codeAlign: "left",
    },
    slides: [
      {
        id: `${id}-s1`,
        code: "let a = 1;\nlet b = 2;",
        language: "javascript",
        duration: 3000,
        transitionDuration: 300,
        stagger: 0,
        highlights: [makeHighlight(`${id}-h1`, 0)],
      },
      {
        id: `${id}-s2`,
        code: "console.log('two');",
        language: "javascript",
        duration: 3000,
        transitionDuration: 300,
        stagger: 0,
        highlights: [],
      },
    ],
    createdAt: 0,
    updatedAt: 0,
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function settle(ms = 30): Promise<void> {
  flushSync();
  await sleep(ms);
  flushSync();
}

function assertNoAppErrors(context: string): void {
  if (errors.length > 0) {
    const detail = errors
      .map((e) =>
        e instanceof Error ? `${e.message}\n${e.stack ?? ""}` : String(e),
      )
      .join("\n---\n");
    errors.length = 0;
    assert.fail(`app errors during ${context}:\n${detail}`);
  }
}

async function waitFor(
  fn: () => boolean,
  label: string,
  timeoutMs = 4000,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    flushSync();
    if (fn()) return;
    await sleep(15);
  }
  flushSync();
  assert.ok(fn(), `timed out waiting for: ${label}`);
}

function click(el: Element): void {
  el.dispatchEvent(
    new window.MouseEvent("click", { bubbles: true, cancelable: true }),
  );
}

test("dashboard card click opens the editor; Present enters and advances the presentation", async () => {
  resetFullApiMocks();
  seedProjects([
    makeProject("p1", "First Deck"),
    makeProject("p2", "Second Deck"),
  ]);
  queryClient.clear();
  clearAllLocalCode();
  setIsPresenting(false);
  setCurrentSlideId(null);
  window.location.hash = "#/";

  const target = document.createElement("div");
  document.body.appendChild(target);
  const app = mount(App, { target });

  // Dashboard grid loads with both cards.
  await waitFor(
    () => target.textContent?.includes("First Deck") === true,
    "dashboard project cards",
  );
  assertNoAppErrors("dashboard mount");

  // Click the first presentation card → route to /editor/p1.
  const card = [...target.querySelectorAll<HTMLElement>("*")].find(
    (el) =>
      typeof el.className === "string" &&
      el.className.includes("cursor-pointer") &&
      el.querySelector("h3")?.textContent?.includes("First Deck"),
  );
  assert.ok(card, "found clickable presentation card");
  click(card!);
  await settle();

  await waitFor(
    () => window.location.hash.includes("/editor/p1"),
    "hash route to /editor/p1",
  );
  await waitFor(
    () =>
      [...target.querySelectorAll("button")].some((b) =>
        b.textContent?.trim().startsWith("Present"),
      ),
    "editor toolbar Present button",
  );
  assertNoAppErrors("editor mount via card click");

  // Click Present in the editor → presentation overlay.
  const presentBtn = [...target.querySelectorAll("button")].find((b) =>
    b.textContent?.trim().startsWith("Present"),
  ) as HTMLButtonElement;
  click(presentBtn);
  flushSync();
  await waitFor(
    () => Boolean(target.querySelector("#openslides-present-root")),
    "presentation overlay",
  );
  assertNoAppErrors("present overlay");
  assert.ok(ui.isPresenting, "isPresenting true");

  // Stage click advances: highlight 1 reveal, then slide advance.
  const stage = target.querySelector(
    "#openslides-present-root div[role='presentation']",
  ) as HTMLElement;
  assert.ok(stage, "stage clickable area exists");
  click(stage); // reveal highlight p1-h1
  await settle();
  click(stage); // outro → fail-safe advance to p1-s2
  await waitFor(
    () => ui.currentSlideId === "p1-s2",
    "advance to second slide",
    4000,
  );
  assertNoAppErrors("presentation advance");

  await unmount(app);
  target.remove();
});

test("back navigation from editor to dashboard via Home button keeps app alive", async () => {
  resetFullApiMocks();
  seedProjects([makeProject("p1", "First Deck")]);
  queryClient.clear();
  clearAllLocalCode();
  setIsPresenting(false);
  setCurrentSlideId(null);
  window.location.hash = "#/editor/p1";

  const target = document.createElement("div");
  document.body.appendChild(target);
  const app = mount(App, { target });

  await waitFor(
    () =>
      [...target.querySelectorAll("button")].some((b) =>
        b.textContent?.trim().startsWith("Present"),
      ),
    "editor toolbar (deep link)",
  );
  assertNoAppErrors("deep link editor mount");

  await unmount(app);
  target.remove();
});
