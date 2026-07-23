/**
 * Present-flow suite — mounts the REAL EditorInner.svelte in jsdom (with the
 * full in-memory tauri-api mock, shiki mock, and no-op Tauri runtime) and
 * replays the user report:
 *
 *   "can't click on presentation"
 *
 * The suite drives the exact production wiring:
 *   toolbar "Present" button → enterPresent() → ui.isPresenting →
 *   PresentOverlay → stage click → createHighlightNav stepping → slide advance.
 *
 * Any mount-time throw in the overlay chain is captured via process-level
 * handlers and fails the test with the underlying error.
 */
// MUST be the first import (installs document/window for the components).
import "./helpers/jsdom-env.mts";

import test from "node:test";
import assert from "node:assert/strict";
import { flushSync, mount, unmount } from "svelte";
import EditorInner from "../src/features/editor/EditorInner.svelte";
import { ui, setIsPresenting, setCurrentSlideId } from "../src/shared/stores/ui-state.svelte";
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

function makeProject(): Project {
  return {
    id: "p1",
    name: "Demo Deck",
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
        id: "s1",
        code: "let a = 1;\nlet b = 2;\nlet c = 3;",
        language: "javascript",
        duration: 3000,
        transitionDuration: 300,
        stagger: 0,
        highlights: [makeHighlight("h1", 0), makeHighlight("h2", 1)],
      },
      {
        id: "s2",
        code: "console.log('second slide');",
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

async function waitFor(
  fn: () => boolean,
  label: string,
  timeoutMs = 3000,
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

function assertNoAppErrors(context: string): void {
  if (errors.length > 0) {
    const detail = errors
      .map((e) => (e instanceof Error ? `${e.message}\n${e.stack ?? ""}` : String(e)))
      .join("\n---\n");
    errors.length = 0;
    assert.fail(`app errors during ${context}:\n${detail}`);
  }
}

function click(el: Element): void {
  el.dispatchEvent(
    new window.MouseEvent("click", { bubbles: true, cancelable: true }),
  );
}

test("toolbar Present button mounts the presentation overlay and stage clicks step through highlights and slides", async () => {
  resetFullApiMocks();
  seedProjects([makeProject()]);
  queryClient.clear();
  clearAllLocalCode();
  setIsPresenting(false);
  setCurrentSlideId(null);

  const target = document.createElement("div");
  document.body.appendChild(target);
  const app = mount(EditorInner, { target, props: { projectId: "p1" } });

  // Project loads (mock IPC) → toolbar with the real Present button appears.
  await waitFor(
    () =>
      [...target.querySelectorAll("button")].some((b) =>
        b.textContent?.trim().startsWith("Present"),
      ),
    "toolbar Present button",
  );
  assertNoAppErrors("project load");

  const presentBtn = [...target.querySelectorAll("button")].find((b) =>
    b.textContent?.trim().startsWith("Present"),
  ) as HTMLButtonElement;
  click(presentBtn);
  flushSync();

  assert.equal(ui.isPresenting, true, "ui.isPresenting after Present click");
  await waitFor(
    () => Boolean(target.querySelector("#openslides-present-root")),
    "presentation overlay root",
  );
  assertNoAppErrors("present overlay mount");
  assert.ok(
    target.querySelector("#openslides-present-root"),
    "overlay rendered",
  );

  // Stage = the full-bleed click target inside the overlay root.
  const stage = target.querySelector(
    "#openslides-present-root div[role='presentation']",
  ) as HTMLElement;
  assert.ok(stage, "stage click target exists");

  // Click 1/2/3 → reveal highlight 1, reveal highlight 2, outro→advance.
  click(stage);
  await settle();
  assert.equal(ui.isPresenting, true, "still presenting after click 1");
  assertNoAppErrors("stage click 1 (reveal highlight 1)");

  click(stage);
  await settle();
  assertNoAppErrors("stage click 2 (reveal highlight 2)");

  click(stage);
  await settle();
  // Outro booked; fail-safe (≤750ms here) performs the slide advance.
  await waitFor(
    () => ui.currentSlideId === "s2",
    "advance to slide 2 after last highlight outro",
    4000,
  );
  assert.equal(ui.currentSlideId, "s2", "advanced to second slide");
  assertNoAppErrors("outro → slide advance");

  // One more click on the clean final slide ends the deck (stays presenting).
  click(stage);
  await settle();
  assert.equal(ui.currentSlideId, "s2", "no third slide to advance to");
  assertNoAppErrors("final click");

  await unmount(app);
  target.remove();
});

test("direct enterPresent (menu://present path) renders overlay; ESC control exits", async () => {
  resetFullApiMocks();
  seedProjects([makeProject()]);
  queryClient.clear();
  clearAllLocalCode();
  setIsPresenting(false);
  setCurrentSlideId(null);

  const target = document.createElement("div");
  document.body.appendChild(target);
  const app = mount(EditorInner, { target, props: { projectId: "p1" } });

  await waitFor(
    () =>
      [...target.querySelectorAll("button")].some((b) =>
        b.textContent?.trim().startsWith("Present"),
      ),
    "toolbar Present button",
  );

  // Same state transition the menu://present and CommandPalette paths run.
  setIsPresenting(true);
  flushSync();
  await waitFor(
    () => Boolean(target.querySelector("#openslides-present-root")),
    "presentation overlay root",
  );
  assertNoAppErrors("menu-path present");

  // Exit via the overlay's own control (Press ESC to exit button).
  const exitBtn = [...target.querySelectorAll("button")].find((b) =>
    b.textContent?.includes("to exit"),
  ) as HTMLButtonElement;
  assert.ok(exitBtn, "exit control exists");
  click(exitBtn);
  await settle();
  assert.equal(ui.isPresenting, false, "exited presenting");
  assertNoAppErrors("exit present");

  await unmount(app);
  target.remove();
});
