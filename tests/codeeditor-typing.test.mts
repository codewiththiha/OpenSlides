/**
 * CodeEditor caret suite — mounts the REAL CodeEditor.tsx (with shiki
 * stubbed to null and tauri-ipc mocked) and replays the user report:
 *   "editing `exa|ple` teleports to `example|` on every keystroke;
 *    with 100 lines, editing line 4 throws the caret to line 100's end."
 *
 * The value-wiring harness in editor-save-race.test.mts could NOT reproduce
 * a mid-line teleport, so this suite mounts the whole editor to either (a)
 * catch the culprit among its real effects/overlays, or (b) prove the
 * component is faithful in a spec-conformant DOM and narrow the field to
 * WKWebView-specific behavior.
 */
// MUST be the first import (installs document/window for react-dom).
import "./helpers/jsdom-env.mts";

import test from "node:test";
import assert from "node:assert/strict";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { CodeEditor } from "../src/components/CodeEditor";
import { useUiStore } from "../src/store/useUiStore";
import type { Project, Slide } from "../src/types";
import { pendingSaves, resolveSaveAt, resetApiMocks } from "./mocks/tauri-api.mock.mts";

const h = React.createElement;

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

/** Feed CodeEditor from the query cache, exactly like Editor.tsx does,
 *  so onSuccess cache stamps flow in as new props. */
function EditorFromQuery() {
  const { data: project } = useQuery<Project>({ queryKey: ["project", "p1"] });
  return project ? h(CodeEditor, { project }) : null;
}

interface Mounted {
  root: Root;
  el: HTMLTextAreaElement;
  /** Highlight-overlay <code> element (the visible text surface). */
  overlayEl: HTMLElement;
  unmount: () => Promise<void>;
}

async function mountEditor(project: Project): Promise<Mounted> {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  qc.setQueryData(["project", project.id], project);
  useUiStore.setState({ currentSlideId: "s1", localCode: {} });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  try {
    await act(async () => {
      root.render(
        h(QueryClientProvider, { client: qc }, h(EditorFromQuery)),
      );
    });
  } catch (e: any) {
    // act() re-throws as AggregateError — print members for diagnosis.
    console.error(
      "MOUNT AGGREGATE:",
      e?.errors?.map((x: unknown) =>
        x instanceof Error ? `${x.name}: ${x.message}\n${x.stack}` : JSON.stringify(x),
      ) ?? e,
    );
    throw e;
  }
  const el = container.querySelector("textarea");
  assert.ok(el, "CodeEditor rendered its textarea");
  el.focus();
  const overlayEl = container.querySelector(".editor-highlight code");
  assert.ok(overlayEl, "CodeEditor rendered its highlight overlay");
  return {
    root,
    el,
    overlayEl: overlayEl as HTMLElement,
    unmount: async () => {
      await act(async () => root.unmount());
      container.remove();
      qc.clear();
      for (const p of (process as any)._getActiveHandles?.() ?? []) {
        if (p?.constructor?.name === "MessagePort") p.unref?.();
      }
    },
  };
}

/** Faithful mid-line keystroke: native setter (bypassing React's value
 *  tracker like a real browser edit does), caret placed after the inserted
 *  char, bubbling input event. */
async function typeAt(
  el: HTMLTextAreaElement,
  offset: number,
  inserted: string,
): Promise<void> {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    "value",
  )!.set!;
  const next =
    el.value.slice(0, offset) + inserted + el.value.slice(offset);
  await act(async () => {
    setter.call(el, next);
    el.setSelectionRange(offset + inserted.length, offset + inserted.length);
    el.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
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
  await act(async () => {
    while (pendingSaves.length) resolveSaveAt(0);
  });
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
  assert.match(pre.innerHTML, /style="color:/, "colored immediately after keystroke 1");
  assert.equal(
    pre.textContent,
    el.value + "\n",
    "overlay content exactly matches the textarea (alignment preserved)",
  );

  await typeAt(el, off + 1, "Y");
  assert.match(pre.innerHTML, /style="color:/, "colored immediately after keystroke 2");
  assert.equal(pre.textContent, el.value + "\n");

  await typeAt(el, off + 2, "Z");
  assert.match(pre.innerHTML, /style="color:/, "colored immediately after keystroke 3");
  assert.equal(pre.textContent, el.value + "\n", "still exact after a burst");

  await m.unmount();
});

test("CodeEditor: merustmar deck stays COLORED via the Shiki pipeline", async () => {
  resetApiMocks();
  const m = await mountEditor(makeProject(makeLineCode(50), "merustmar"));
  const el = m.el;
  const pre = m.overlayEl;

  // The frozen JS highlighter runs synchronously in render — colored even
  // before/without any Shiki WASM, and on every keystroke thereafter.
  assert.match(pre.innerHTML, /style="color:/, "merustmar overlay colored at mount");

  const off = offsetOfLine(el.value, 1, 3);
  await typeAt(el, off, "A");
  assert.match(pre.innerHTML, /style="color:/, "merustmar colored after keystroke 1");
  assert.equal(pre.textContent, el.value + "\n", "exact content preserved");

  await typeAt(el, off + 1, "B");
  assert.match(pre.innerHTML, /style="color:/, "merustmar colored after keystroke 2");
  assert.equal(pre.textContent, el.value + "\n");

  await m.unmount();
});
