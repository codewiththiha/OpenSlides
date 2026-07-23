/**
 * CodeEditor caret suite — mounts the REAL Svelte 5 CodeEditor.svelte (with
 * shiki mocked to a deterministic highlighter and tauri-ipc mocked) and
 * replays the user report:
 *   "editing `exa|ple` teleports to `example|` on every keystroke;
 *    with 100 lines, editing line 4 throws the caret to line 100's end."
 *
 * The value-wiring harness in editor-save-race.test.mts could NOT reproduce
 * a mid-line teleport, so this suite mounts the whole editor to either (a)
 * catch the culprit among its real effects/overlays, or (b) prove the
 * component is faithful in a spec-conformant DOM and narrow the field to
 * WKWebView-specific behavior.
 *
 * Svelte 5 port note: the mounted editor renders an UNCONTROLLED textarea
 * (value written once at mount; typing/save cycles never re-assign it from
 * code), which structurally removes the regression+teleport path the React
 * version had. These tests keep asserting that invariant end-to-end.
 */
// MUST be the first import (installs document/window for the components).
import "./helpers/jsdom-env.mts";

import test from "node:test";
import assert from "node:assert/strict";
import { flushSync, mount, tick, unmount } from "svelte";
import CodeEditorHost from "./harness/CodeEditorHost.svelte";
import { queryClient } from "../src/queries/query-client";
import { setCurrentSlideId } from "../src/store/ui-state.svelte";
import { clearAllLocalCode } from "../src/store/slide-code.svelte";
import type { Project, Slide } from "../src/types";
import { pendingSaves, resolveSaveAt, resetApiMocks } from "./mocks/tauri-api.mock.mts";

function makeLineCode(lines: number): string {
  return Array.from({ length: lines }, (_, i) => `let v${i + 1} = ${i + 1};`).join("\n");
}

function makeProject(code: string, language = "rust"): Project {
  const slide: Slide = {
    id: "s1",
    code,
    language,
    duration: 1000,
    transitionDuration: 300,
    stagger: 0,
    highlights: [],
  };
  return {
    id: "p1",
    name: "demo",
    theme: "github-dark",
    settings: {
      showLineNumbers: true,
      fontSize: 16,
      lineHeight: 1.4,
      editorFontSize: 14,
      useGlobalTransition: false,
      globalTransitionDuration: 300,
      useGlobalStagger: false,
      globalStagger: 0,
      currentSlideId: "s1",
      language,
      codeBlockPosition: "left",
    } as Project["settings"],
    slides: [slide],
    createdAt: 0,
    updatedAt: 0,
  };
}

/** Let effects, the zeroed shiki debounce, and microtask chains settle. */
async function settle(ms = 25): Promise<void> {
  flushSync();
  await new Promise((r) => setTimeout(r, ms));
  flushSync();
}

interface Mounted {
  el: HTMLTextAreaElement;
  /** Highlight-overlay <code> element (the visible text surface). */
  overlayEl: HTMLElement;
  unmount: () => Promise<void>;
}

async function mountEditor(project: Project): Promise<Mounted> {
  queryClient.clear();
  clearAllLocalCode();
  queryClient.setQueryData(["project", project.id], project);
  setCurrentSlideId("s1");
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = mount(CodeEditorHost as never, {
    target: container,
    props: { project },
  });
  flushSync();
  await settle();
  const el = container.querySelector("textarea");
  assert.ok(el, "CodeEditor rendered its textarea");
  el.focus();
  const overlayEl = container.querySelector(".editor-highlight code");
  assert.ok(overlayEl, "CodeEditor rendered its highlight overlay");
  return {
    el,
    overlayEl: overlayEl as HTMLElement,
    unmount: async () => {
      await unmount(app as never);
      container.remove();
      queryClient.clear();
      clearAllLocalCode();
    },
  };
}

/** Faithful mid-line keystroke: native setter (no framework value tracker,
 *  like a real browser edit), caret placed after the inserted char,
 *  bubbling input event, then a flush for the uncontrolled editor. */
async function typeAt(
  el: HTMLTextAreaElement,
  offset: number,
  inserted: string,
): Promise<void> {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    "value",
  )!.set!;
  const next = el.value.slice(0, offset) + inserted + el.value.slice(offset);
  setter.call(el, next);
  el.setSelectionRange(offset + inserted.length, offset + inserted.length);
  el.dispatchEvent(new window.Event("input", { bubbles: true }));
  flushSync();
  await tick();
}

function offsetOfLine(code: string, lineIdx: number, col: number): number {
  const lines = code.split("\n");
  return lines.slice(0, lineIdx).reduce((n, l) => n + l.length + 1, 0) + col;
}

test("CodeEditor: mid-line edits keep the caret (user's 'example|' report)", async () => {
  resetApiMocks();
  const code = makeLineCode(100);
  const m = await mountEditor(makeProject(code));
  const el = m.el;

  // Line index 3 (4th line): "let v4 = 4;" — insert "X" after "let v".
  const off = offsetOfLine(el.value, 3, 5);
  await typeAt(el, off, "X");
  assert.equal(
    el.selectionStart,
    off + 1,
    "caret stayed on line 4 after the first keystroke",
  );
  assert.ok(
    el.value.split("\n")[3] === "let vX4 = 4;",
    "line 4 got the character",
  );

  // Second keystroke, same spot, still before any save cycle.
  await typeAt(el, off + 1, "Y");
  assert.equal(el.selectionStart, off + 2, "caret kept mid-line position");

  // The slow-typist rhythm: let the 500ms auto-save actually fire, resolve
  // the write, then keep editing mid-line — the reported worst case.
  await new Promise((r) => setTimeout(r, 650));
  assert.ok(pendingSaves.length >= 1, "auto-save fired during the pause");
  while (pendingSaves.length) {
    resolveSaveAt(0);
    await settle(10);
  }
  // Caret after idle: jsdom keeps selection on blur-free commits — assert
  // the textarea value itself did not regress around the save.
  assert.equal(
    el.value.split("\n")[3],
    "let vXY4 = 4;",
    "save cycle did not regress the content",
  );

  await typeAt(el, off + 2, "Z");
  assert.equal(
    el.selectionStart,
    off + 3,
    "caret still mid-line after a full save cycle",
  );

  await m.unmount();
});

test("CodeEditor: append at end also keeps caret at end (control case)", async () => {
  resetApiMocks();
  const m = await mountEditor(makeProject(makeLineCode(5)));
  const el = m.el;
  const end = el.value.length;
  await typeAt(el, end, "\nlet extra = 1;");
  assert.equal(el.selectionStart, end + "\nlet extra = 1;".length);
  await m.unmount();
});

test("CodeEditor: shiki path stays COLORED and exact on every keystroke (no white flash)", async () => {
  resetApiMocks();
  const m = await mountEditor(makeProject(makeLineCode(100)));
  const el = m.el;
  const pre = m.overlayEl;

  // Color must be present once the highlighter has arrived (mount flush).
  assert.match(
    pre.innerHTML,
    /style="color:/,
    "overlay is colored after mount — no plain interim for shiki decks",
  );

  const off = offsetOfLine(el.value, 3, 5);
  await typeAt(el, off, "X");
  await settle();
  assert.match(pre.innerHTML, /style="color:/, "colored immediately after keystroke 1");
  assert.equal(
    pre.textContent,
    el.value + "\n",
    "overlay content exactly matches the textarea (alignment preserved)",
  );

  await typeAt(el, off + 1, "Y");
  await settle();
  assert.match(pre.innerHTML, /style="color:/, "colored immediately after keystroke 2");
  assert.equal(pre.textContent, el.value + "\n");

  await typeAt(el, off + 2, "Z");
  await settle();
  assert.match(pre.innerHTML, /style="color:/, "colored immediately after keystroke 3");
  assert.equal(pre.textContent, el.value + "\n", "still exact after a burst");

  await m.unmount();
});

test("CodeEditor: merustmar deck stays COLORED via the Shiki pipeline", async () => {
  resetApiMocks();
  const m = await mountEditor(makeProject(makeLineCode(50), "merustmar"));
  const el = m.el;
  const pre = m.overlayEl;

  // Colored at mount, and on every keystroke thereafter.
  assert.match(pre.innerHTML, /style="color:/, "merustmar overlay colored at mount");

  const off = offsetOfLine(el.value, 1, 3);
  await typeAt(el, off, "A");
  await settle();
  assert.match(pre.innerHTML, /style="color:/, "merustmar colored after keystroke 1");
  assert.equal(pre.textContent, el.value + "\n", "exact content preserved");

  await typeAt(el, off + 1, "B");
  await settle();
  assert.match(pre.innerHTML, /style="color:/, "merustmar colored after keystroke 2");
  assert.equal(pre.textContent, el.value + "\n");

  await m.unmount();
});
