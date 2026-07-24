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
import { toastCalls } from "./mocks/toast.mock.mts";

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

function makeProject(id: string, name: string, slideCount = 2): Project {
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
    slides: Array.from({ length: slideCount }, (_, index) => ({
      id: `${id}-s${index + 1}`,
      code:
        index === 0
          ? "let a = 1;\nlet b = 2;"
          : `console.log('slide ${index + 1}');`,
      language: "javascript",
      duration: 3000,
      transitionDuration: 300,
      stagger: 0,
      highlights: index === 0 ? [makeHighlight(`${id}-h1`, 0)] : [],
    })),
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

function contextMenu(el: Element, x = 40, y = 40): void {
  el.dispatchEvent(
    new window.MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      button: 2,
      clientX: x,
      clientY: y,
    }),
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

test("multi-select stays in sync after per-card delete and bulk delete offers undo", async () => {
  resetFullApiMocks();
  toastCalls.length = 0;
  seedProjects([makeProject("p1", "Bulk Delete Deck", 5)]);
  queryClient.clear();
  clearAllLocalCode();
  setIsPresenting(false);
  setCurrentSlideId(null);
  window.location.hash = "#/editor/p1";

  const target = document.createElement("div");
  document.body.appendChild(target);
  const app = mount(App, { target });

  await waitFor(
    () => target.querySelectorAll("[data-slide-id]").length === 5,
    "five slide cards",
  );
  assertNoAppErrors("multi-select editor mount");

  const cards = () => [
    ...target.querySelectorAll<HTMLElement>("[data-slide-id]"),
  ];
  contextMenu(cards()[0]!);
  await waitFor(
    () =>
      [...target.querySelectorAll("button")].some(
        (button) => button.textContent?.trim() === "Select multiple",
      ),
    "slide context menu",
  );
  const selectMultiple = [...target.querySelectorAll("button")].find(
    (button) => button.textContent?.trim() === "Select multiple",
  );
  assert.ok(selectMultiple, "found Select multiple action");
  click(selectMultiple!);
  await settle();

  click(cards()[1]!);
  click(cards()[2]!);
  click(cards()[3]!);
  await settle();

  await waitFor(
    () => target.querySelector("[title='4 slides selected']") !== null,
    "selection count = 4",
  );

  const selectedCard = cards()[1]!;
  const deleteButton = selectedCard.querySelector(
    "button[title='Delete slide']",
  ) as HTMLButtonElement | null;
  assert.ok(deleteButton, "selected slide exposes per-card delete");
  click(deleteButton!);

  await waitFor(
    () => target.querySelectorAll("[data-slide-id]").length === 4,
    "per-card delete removes one selected slide",
  );
  await waitFor(
    () => target.querySelector("[title='3 slides selected']") !== null,
    "selection count pruned to 3",
  );
  assertNoAppErrors("selection prune after per-card delete");

  const bulkDeleteButton = target.querySelector(
    "button[title='Delete selected']",
  ) as HTMLButtonElement | null;
  assert.ok(bulkDeleteButton, "bulk delete button present");
  assert.equal(bulkDeleteButton?.disabled, false, "bulk delete stays enabled");

  toastCalls.length = 0;
  click(bulkDeleteButton!);
  await waitFor(
    () => target.textContent?.includes("Delete 3 selected slides?") === true,
    "bulk delete confirm dialog",
  );
  const confirmDelete = [...target.querySelectorAll("button")].find(
    (button) => button.textContent?.trim() === "Delete",
  );
  assert.ok(confirmDelete, "confirm delete button exists");
  click(confirmDelete!);

  await waitFor(
    () => target.querySelectorAll("[data-slide-id]").length === 1,
    "bulk delete leaves one slide",
  );
  await waitFor(
    () => toastCalls.some((call) => call.kind === "message"),
    "bulk delete toast",
  );

  const undoToast = toastCalls.findLast((call) => call.kind === "message");
  assert.equal(undoToast?.msg, "3 slides deleted");
  assert.equal(undoToast?.action?.label, "Undo");
  undoToast?.action?.onClick();

  await waitFor(
    () =>
      target.querySelectorAll("[data-slide-id]").length === 4 ||
      toastCalls.some((call) => call.kind === "error"),
    "bulk undo restores deleted slides",
  );
  const undoError = toastCalls.find((call) => call.kind === "error");
  assert.equal(undoError, undefined, undoError?.msg ?? "unexpected undo error");
  await waitFor(
    () =>
      toastCalls.some(
        (call) => call.kind === "success" && call.msg === "3 slides restored",
      ),
    "bulk undo success toast",
  );
  assertNoAppErrors("bulk delete undo");

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
