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

/**
 * Realistic WAAPI stub for THIS suite: jsdom-env's global stub never fires
 * `onfinish`, so outrostart/outroend and everything they arm (exit
 * bookkeeping, exit-complete → finishPending) never runs. Here animations
 * complete on a real timer at their duration — the same signals a browser
 * produces — so machinery driven by transition events is actually tested.
 */
{
  const proto = window.HTMLElement.prototype as unknown as Record<
    string,
    unknown
  >;
  proto.animate = function (
    _keyframes: unknown,
    opts?: number | KeyframeAnimationOptions,
  ) {
    const timing =
      (typeof opts === "number" ? opts : (opts?.duration ?? 0)) +
      (typeof opts === "object" ? (opts?.delay ?? 0) : 0);
    let onfinish: ((this: unknown) => void) | null = null;
    let timer = 0;
    const anim: Record<string, unknown> = {
      cancel() {
        window.clearTimeout(timer);
        onfinish = null;
      },
      finish() {
        window.clearTimeout(timer);
        const f = onfinish;
        onfinish = null;
        f?.call(anim);
      },
      pause() {},
      play() {},
      reverse() {},
      addEventListener() {},
      removeEventListener() {},
      currentTime: 0,
      playbackRate: 1,
      playState: "pending",
      effect: null,
      timeline: null,
    };
    anim.finished = Promise.resolve(anim);
    anim.ready = Promise.resolve(anim);
    Object.defineProperty(anim, "onfinish", {
      configurable: true,
      get: () => onfinish,
      set: (f) => {
        onfinish = f;
        window.clearTimeout(timer);
        if (f) timer = window.setTimeout(() => anim.finish(), timing);
      },
    });
    return anim;
  };
}

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
      .map((e) =>
        e instanceof Error ? `${e.message}\n${e.stack ?? ""}` : String(e),
      )
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

  // Click 1 → reveal highlight 1 instantly.
  click(stage);
  await settle();
  assert.equal(ui.isPresenting, true, "still presenting after click 1");
  assertNoAppErrors("stage click 1 (reveal highlight 1)");

  // Click 2 → step directly to highlight 2 (steps overlap: the previous
  // clone's outro plays together with the incoming intro).
  click(stage);
  await settle();
  await waitFor(
    () =>
      [...target.querySelectorAll("[role='status']")].some(
        (el) => el.getAttribute("aria-label") === "Highlight 2 of 2",
      ),
    "highlight 2 revealed",
    4000,
  );
  assertNoAppErrors("stage click 2 (reveal highlight 2)");

  click(stage);
  await settle();
  // Outro booked; fail-safe performs the slide advance.
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

test("editor: reveal highlight via number key, then back to clean (0) — no render crash", async () => {
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
  assertNoAppErrors("project load");

  const pressKey = (k: string) => {
    window.dispatchEvent(
      new window.KeyboardEvent("keydown", { key: k, cancelable: true }),
    );
    flushSync();
  };

  // Reveal highlight 1 in the editor preview (number keys work outside present).
  pressKey("1");
  await settle();
  await waitFor(
    () =>
      [...target.querySelectorAll("[role='status']")].some(
        (el) => el.getAttribute("aria-label") === "Highlight 1 of 2",
      ),
    "highlight 1 revealed in editor",
    4000,
  );
  assertNoAppErrors("reveal highlight 1 (editor)");
  await settle(300);

  // Back to clean slide: the clone+dim outro must play without crashing.
  pressKey("0");
  await settle(1200); // outro + fail-safe window
  assertNoAppErrors("back to clean slide after highlight");
  assert.ok(
    !target.textContent?.includes("Rendering error"),
    "preview must NOT hit the render boundary after going backward",
  );

  await unmount(app);
  target.remove();
});

test("present: forward then BACKWARD through highlights (ArrowLeft) — no render crash", async () => {
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
  const presentBtn = [...target.querySelectorAll("button")].find((b) =>
    b.textContent?.trim().startsWith("Present"),
  ) as HTMLButtonElement;
  click(presentBtn);
  flushSync();
  await waitFor(
    () => Boolean(target.querySelector("#openslides-present-root")),
    "presentation overlay root",
  );

  const pressKey = (k: string) => {
    window.dispatchEvent(
      new window.KeyboardEvent("keydown", { key: k, cancelable: true }),
    );
    flushSync();
  };

  pressKey("ArrowRight"); // reveal h1
  await settle();
  pressKey("ArrowRight"); // reveal h2
  await settle();
  await waitFor(
    () =>
      [...target.querySelectorAll("[role='status']")].some(
        (el) => el.getAttribute("aria-label") === "Highlight 2 of 2",
      ),
    "highlight 2 revealed",
    4000,
  );
  assertNoAppErrors("forward reveals");
  await settle(300);

  pressKey("ArrowLeft"); // backward step h2 → h1 (force re-tokenize + swap)
  await settle(800);
  assertNoAppErrors("backward step h2 -> h1");

  pressKey("ArrowLeft"); // backward h1 → clean (outro-to-clean)
  await settle(1200);
  assertNoAppErrors("backward h1 -> clean");
  assert.ok(
    !target.textContent?.includes("Rendering error"),
    "preview must NOT hit the render boundary after going backward",
  );

  await unmount(app);
  target.remove();
});

test("editor: size-up highlight toggled rapidly forward/backward — no render crash", async () => {
  resetFullApiMocks();
  const proj = makeProject();
  proj.slides[0]!.highlights = proj.slides[0]!.highlights.map((h) => ({
    ...h,
    sizeUpEnabled: true,
    sizeUpAmount: 150,
    useCustomTransition: true,
    dimTransition: 700,
    sizeUpTransition: 900,
  }));
  seedProjects([proj]);
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

  const pressKey = (k: string) => {
    window.dispatchEvent(
      new window.KeyboardEvent("keydown", { key: k, cancelable: true }),
    );
    flushSync();
  };

  pressKey("1");
  await settle(250); // mid-intro
  pressKey("0"); // back to clean mid-intro
  await settle(300);
  pressKey("2"); // jump straight to highlight 2 from clean
  await settle(250);
  pressKey("1"); // backward step h2 → h1 (re-tokenize + swap)
  await settle(300);
  pressKey("0"); // h1 → clean
  await settle(1600); // let custom outros + fail-safe fully elapse
  pressKey("1"); // forward again after everything
  await settle(300);
  pressKey("0");
  await settle(1600);

  assertNoAppErrors("rapid forward/backward with size-up");
  assert.ok(
    !target.textContent?.includes("Rendering error"),
    "preview must NOT hit the render boundary",
  );

  await unmount(app);
  target.remove();
});
