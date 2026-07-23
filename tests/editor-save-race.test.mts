/**
 * Save-race regression suite — "type one char, caret teleports to the end".
 *
 * Root cause (user-reported, reproduced here in jsdom): CodeEditor's
 * auto-save fired independent mutations straight at the IPC layer. Two
 * saves could be in flight at once and the Rust side serves them from a
 * 5-connection SQLite pool, so an OLDER value could resolve LAST. Its
 * onSuccess then stamped the stale value into the query cache — and once
 * the localCode shadow was cleared, the editor rendered that older string,
 * the controlled textarea got a *different* value assignment, and the caret
 * was slammed to the end (a spec'd side effect of programmatic value
 * assignment). Worse: the DB row itself regressed — silent data loss.
 *
 * Fix under test:
 *   - src/lib/code-save.ts — serialized per-slide saves.
 *   - mergeSlidePreservingEditorCode in src/queries/slides.ts — settings
 *     responses can no longer carry a stale `code` column into the cache.
 *
 * The Svelte 5 CodeEditor additionally renders an UNCONTROLLED textarea
 * (value written once at mount, never again), so even a stale stamp can no
 * longer slam the caret. The harness mirrors that wiring faithfully (same
 * `localCode[slideId] ?? slide.code` expression, same onChange flow of
 * setLocalCode + mutation); only the 500ms debounce is replaced by manually
 * controlled mutation firing — the debounce was verified not to be the
 * culprit.
 */
// MUST be the first import (installs document/window for the components).
import "./helpers/jsdom-env.mts";

import test from "node:test";
import assert from "node:assert/strict";
import { flushSync, mount, unmount } from "svelte";
import SaveRaceHarness from "./harness/SaveRaceHarness.svelte";
import {
  enqueueCodeSave,
  pendingSaveChains,
  pendingSaveChainKeys,
} from "../src/lib/code-save";
import { mergeSlidePreservingEditorCode } from "../src/queries/slides";
import { queryClient } from "../src/queries/query-client";
import { clearAllLocalCode } from "../src/store/slide-code.svelte";
import type { Project, Slide } from "../src/types";
import {
  saveCalls,
  pendingSaves,
  resolveSaveAt,
  resetApiMocks,
} from "./mocks/tauri-api.mock.mts";

function makeProject(slideCode: string, slideId = "s1"): Project {
  const slide: Slide = {
    id: slideId,
    code: slideCode,
    language: "rust",
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
      showLineNumbers: false,
      fontSize: 16,
      lineHeight: 1.4,
      editorFontSize: 14,
      useGlobalTransition: false,
      globalTransitionDuration: 300,
      useGlobalStagger: false,
      globalStagger: 0,
      currentSlideId: slideId,
      language: "rust",
      codeBlockPosition: "left",
    } as Project["settings"],
    slides: [slide],
    createdAt: 0,
    updatedAt: 0,
  };
}

const QUERY_KEY = ["project", "p1"];

/** Flush mutation callbacks + the Svelte update that follows them. */
async function settle(): Promise<void> {
  flushSync();
  await Promise.resolve();
  flushSync();
  await new Promise((r) => setTimeout(r, 0));
  flushSync();
}

interface Mounted {
  el: () => HTMLTextAreaElement;
  unmount: () => Promise<void>;
}

function mountHarness(
  project: Project,
  slideId: string,
  mode: "queued" | "prefix",
): Mounted {
  queryClient.clear();
  clearAllLocalCode();
  queryClient.setQueryData(QUERY_KEY, project);
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = mount(SaveRaceHarness as never, {
    target: container,
    props: { slideId, mode },
  });
  flushSync();
  const el = () => {
    const t = container.querySelector("textarea");
    assert.ok(t, "textarea rendered");
    return t;
  };
  return {
    el,
    unmount: async () => {
      await unmount(app as never);
      container.remove();
      queryClient.clear();
    },
  };
}

/** Simulate real typing: native setter bypasses any framework value
 *  tracker, exactly like a user's keystroke does, then a bubbling input.
 *  Async so queued-save microtasks start the write before assertions. */
async function type(el: HTMLTextAreaElement, next: string, caret = next.length): Promise<void> {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    "value",
  )!.set!;
  setter.call(el, next);
  el.setSelectionRange(caret, caret);
  el.dispatchEvent(new window.Event("input", { bubbles: true }));
  flushSync();
  await Promise.resolve();
  flushSync();
}

test("pre-fix model: out-of-order saves regress the editor and slam the caret (characterization)", async () => {
  resetApiMocks();
  const m = mountHarness(makeProject("let x = 1;"), "s1", "prefix");
  const el = m.el();
  el.focus();

  // Keystroke 1 → save A pending. Keystroke 2 → save B pending (A unresolved).
  await type(el, "let x = 1;a");
  await type(el, "let x = 1;ab");
  assert.equal(saveCalls.length, 2);

  // Click into the middle of the code (caret at position 5).
  el.setSelectionRange(5, 5);

  // NEWER save B resolves first: cache stamped "…ab", localCode cleared.
  resolveSaveAt(1);
  await settle();
  assert.equal(el.value, "let x = 1;ab");
  assert.equal(el.selectionStart, 5, "caret survived the in-order stamp");

  // OLDER save A resolves LAST — the bug: stale value stamped with no
  // localCode shadow left to hide it.
  resolveSaveAt(0);
  await settle();
  assert.equal(el.value, "let x = 1;a", "editor content regressed to the stale value");
  assert.equal(
    el.selectionStart,
    "let x = 1;a".length,
    "caret slammed to the end — the user-reported teleport",
  );
  await m.unmount();
});

test("queued saves: out-of-order resolution is structurally impossible; value and caret never move", async () => {
  resetApiMocks();
  const m = mountHarness(makeProject("let x = 1;", "s2"), "s2", "queued");
  const el = m.el();
  el.focus();

  await type(el, "let x = 1;a");
  assert.equal(saveCalls.length, 1, "first write starts immediately");

  await type(el, "let x = 1;ab");
  assert.equal(
    saveCalls.length,
    1,
    "second write is held by the queue while the first is in flight",
  );

  el.setSelectionRange(5, 5);
  const snapshot = el;

  // Resolve save A — save B is only released now, in schedule order.
  resolveSaveAt(0);
  await settle();
  assert.equal(saveCalls.length, 2, "second write released after the first resolved");
  assert.equal(saveCalls[1].code, "let x = 1;ab", "DB application order = schedule order");
  // Cache stamped "…a" while localCode is still "…ab" (not cleared — newer
  // edit present), so the editor value is untouched.
  assert.equal(snapshot.value, "let x = 1;ab");
  assert.equal(snapshot.selectionStart, 5, "caret untouched by the shadowed stamp");

  resolveSaveAt(0);
  await settle();
  assert.equal(snapshot.value, "let x = 1;ab", "clearLocalCode → cache transition is same-string");
  assert.equal(snapshot.selectionStart, 5, "caret never moved");
  assert.equal(pendingSaves.length, 0);
  await m.unmount();
  await new Promise((r) => setTimeout(r, 10));
});

test("mid-line insertion keeps the caret mid-line (no async involved)", async () => {
  resetApiMocks();
  const m = mountHarness(makeProject("example", "s3"), "s3", "queued");
  const el = m.el();
  el.focus();
  // Caret inside the word: "exa|mple" — type "X".
  await type(el, "exaXmple", 4);
  assert.equal(el.value, "exaXmple");
  assert.equal(el.selectionStart, 4, "caret stayed where the user typed");
  await type(el, "exaXYmple", 5);
  assert.equal(el.selectionStart, 5);
  // Drain the two pending saves so this test's queue tail settles — the
  // chain-map cleanup assertion in a later test counts all slides. The
  // queue releases writes one at a time, so the second save only appears
  // in pendingSaves AFTER the first resolves — keep pumping until both
  // calls have flowed through and nothing is left.
  let guard = 12;
  while ((pendingSaves.length > 0 || saveCalls.length < 2) && guard-- > 0) {
    if (pendingSaves.length) resolveSaveAt(0);
    await settle();
  }
  await m.unmount();
  await new Promise((r) => setTimeout(r, 10));
});

test("enqueueCodeSave: strictly sequential per slide", async () => {
  const started: string[] = [];
  const gates: Array<() => void> = [];
  const write = (_id: string, code: string) => {
    started.push(code);
    return new Promise<void>((r) => gates.push(r));
  };
  const j1 = enqueueCodeSave("seq-slide", "c1", write);
  const j2 = enqueueCodeSave("seq-slide", "c2", write);
  const j3 = enqueueCodeSave("seq-slide", "c3", write);
  await Promise.resolve();
  assert.deepEqual(started, ["c1"], "only the first write starts");
  gates[0]();
  await j1;
  await Promise.resolve();
  assert.deepEqual(started, ["c1", "c2"]);
  gates[1]();
  await j2;
  await Promise.resolve();
  assert.deepEqual(started, ["c1", "c2", "c3"]);
  gates[2]();
  await j3;
});

test("enqueueCodeSave: a failed save does not block later ones and rejects its own caller", async () => {
  const started: string[] = [];
  let failFirst = true;
  const write = (_id: string, code: string) => {
    started.push(code);
    return failFirst
      ? Promise.reject(new Error("disk full"))
      : Promise.resolve();
  };
  await assert.rejects(enqueueCodeSave("err-slide", "c1", write), /disk full/);
  failFirst = false;
  await enqueueCodeSave("err-slide", "c2", write);
  assert.deepEqual(started, ["c1", "c2"], "second save ran after the first failed");
});

test("enqueueCodeSave: chains are independent across slides and the map is cleaned up", async () => {
  const started: string[] = [];
  const gates: Array<() => void> = [];
  const write = (id: string, code: string) => {
    started.push(`${id}:${code}`);
    return new Promise<void>((r) => gates.push(r));
  };
  const a = enqueueCodeSave("slide-A", "1", write);
  const b = enqueueCodeSave("slide-B", "1", write);
  await Promise.resolve();
  assert.deepEqual(started.sort(), ["slide-A:1", "slide-B:1"], "no cross-slide waiting");
  for (const g of gates) g();
  await Promise.all([a, b]);
  // The tail entry is dropped in a Promise.finally — poll briefly instead
  // of racing a fixed number of macrotasks.
  let dropped = false;
  for (let i = 0; i < 20 && !dropped; i++) {
    await new Promise((r) => setTimeout(r, 5));
    dropped = pendingSaveChains() === 0;
  }
  if (!dropped) console.log("LEAKED KEYS:", pendingSaveChainKeys());
  assert.ok(dropped, "tail entries dropped after settling");
});

test("mergeSlidePreservingEditorCode: settings responses cannot regress code", () => {
  const cached = {
    id: "s1",
    code: "fn main() { println!(\"new\"); }",
    duration: 1000,
  } as Slide;
  const incoming = {
    ...cached,
    code: "fn main() {} // stale column read before the newest save landed",
    duration: 2500,
    transitionDuration: 450,
  } as Slide;
  const merged = mergeSlidePreservingEditorCode(cached, incoming);
  assert.equal(merged.code, cached.code, "code column preserved from the cache");
  assert.equal(merged.duration, 2500, "settings fields still applied");
  assert.equal(merged.transitionDuration, 450);
});
