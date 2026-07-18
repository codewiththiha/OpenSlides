/**
 * Save-race regression suite — "type one char, caret teleports to the end".
 *
 * Root cause (user-reported, reproduced here in jsdom): CodeEditor's
 * auto-save fired independent mutations straight at the IPC layer. Two
 * saves could be in flight at once and the Rust side serves them from a
 * 5-connection SQLite pool, so an OLDER value could resolve LAST. Its
 * onSuccess then stamped the stale value into the query cache — and once
 * the localCode shadow was cleared, the editor rendered that older string,
 * React committed a *different* textarea value, and the caret was slammed
 * to the end (a spec'd side effect of programmatic value assignment).
 * Worse: the DB row itself regressed — silent data loss.
 *
 * Fix under test:
 *   - src/lib/code-save-queue.ts — serialized per-slide saves.
 *   - mergeSlidePreservingEditorCode in hooks/queries/slides.ts — settings
 *     responses can no longer carry a stale `code` column into the cache.
 *
 * The harness mirrors CodeEditor's wiring faithfully (same selector shape,
 * same `localCode[slideId] ?? slide.code` expression, same onChange flow of
 * setLocalCode + mutation); only the 500ms debounce is replaced by manually
 * controlled mutation firing — the debounce was verified not to be the
 * culprit (use-debounce 10.1.1 returns a stable callback).
 */
// MUST be the first import (installs document/window for react-dom).
import "./helpers/jsdom-env.mts";

import test from "node:test";
import assert from "node:assert/strict";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUiStore } from "../src/store/useUiStore";
import { enqueueCodeSave, pendingSaveChains, pendingSaveChainKeys } from "../src/lib/code-save-queue";
import { useUpdateSlideCode, mergeSlidePreservingEditorCode } from "../src/hooks/queries/slides";
import type { Project, Slide } from "../src/types";
import {
  api,
  saveCalls,
  pendingSaves,
  resolveSaveAt,
  resetApiMocks,
} from "./mocks/tauri-api.mock.mts";

const h = React.createElement;

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

/**
 * Pre-fix save path, kept verbatim as a characterization test: mutationFn
 * fired `api.updateSlideCode` directly (no queue), same onSuccess logic the
 * code shipped with before the fix.
 */
function useUpdateSlideCodeUnqueued() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ slideId, code }: { slideId: string; code: string }) =>
      api.updateSlideCode(slideId, code),
    onSuccess: async (_v: unknown, { slideId, code }: { slideId: string; code: string }) => {
      qc.setQueriesData<Project>({ queryKey: ["project"] }, (old) => {
        if (!old?.slides?.some((s) => s.id === slideId)) return old;
        return {
          ...old,
          slides: old.slides.map((s) =>
            s.id === slideId ? { ...s, code } : s,
          ),
        };
      });
      const { localCode, clearLocalCode } = useUiStore.getState();
      if (localCode[slideId] === undefined || localCode[slideId] === code) {
        clearLocalCode(slideId);
      }
    },
  });
}

interface HarnessProps {
  // Which mutation hook to use — real (queued) or the pre-fix model.
  useMutationHook: () => { mutate: (v: { slideId: string; code: string }) => void };
  slideId: string;
}

function EditorHarness({ useMutationHook, slideId }: HarnessProps) {
  // Same data flow as Editor.tsx → CodeEditor.tsx: project comes from the
  // detail query; the editor value is the localCode shadow falling back to
  // the cached slide code.
  const { data: project } = useQuery<Project>({
    queryKey: QUERY_KEY,
    queryFn: () => new Promise<Project>(() => {}),
    staleTime: Infinity,
  });
  const local = useUiStore((s) => s.localCode);
  const setLocalCode = useUiStore((s) => s.setLocalCode);
  const mutation = useMutationHook();
  if (!project) return null;
  const slide = project.slides.find((s) => s.id === slideId) ?? project.slides[0];
  const code = (slideId && local[slideId]) ?? slide.code;
  return h("textarea", {
    value: code,
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const v = e.target.value;
      setLocalCode(slideId, v);
      mutation.mutate({ slideId, code: v });
    },
  });
}

interface Mounted {
  root: Root;
  el: () => HTMLTextAreaElement;
  qc: QueryClient;
  unmount: () => Promise<void>;
}

async function mount(
  useMutationHook: HarnessProps["useMutationHook"],
  project: Project,
  slideId = "s1",
): Promise<Mounted> {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  qc.setQueryData(QUERY_KEY, project);
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      h(QueryClientProvider, { client: qc }, h(EditorHarness, { useMutationHook, slideId })),
    );
  });
  const el = () => {
    const t = container.querySelector("textarea");
    assert.ok(t, "textarea rendered");
    return t;
  };
  return {
    root,
    el,
    qc,
    unmount: async () => {
      await act(async () => root.unmount());
      container.remove();
      qc.clear();
      // react-dom's scheduler keeps a jsdom MessageChannel open; its ports
      // hold the event loop. Detach-only (unref) — closing would poison the
      // shared channel for later mounts in the same process.
      for (const p of (process as any)._getActiveHandles?.() ?? []) {
        if (p?.constructor?.name === "MessagePort") p.unref?.();
      }
    },
  };
}

/** Simulate real typing: native setter bypasses React's value tracker,
 *  exactly like a user's keystroke does, then a bubbling input event. */
async function type(
  el: HTMLTextAreaElement,
  next: string,
  caret = next.length,
): Promise<void> {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    "value",
  )!.set!;
  await act(async () => {
    setter.call(el, next);
    el.setSelectionRange(caret, caret);
    el.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
}

function resetStore(): void {
  useUiStore.setState({ localCode: {} });
}

test("pre-fix model: out-of-order saves regress the editor and slam the caret (characterization)", async () => {
  resetApiMocks();
  resetStore();
  const m = await mount(useUpdateSlideCodeUnqueued, makeProject("let x = 1;"));
  const el = m.el();
  el.focus();

  // Keystroke 1 → save A pending. Keystroke 2 → save B pending (A unresolved).
  await type(el, "let x = 1;a");
  await type(el, "let x = 1;ab");
  assert.equal(saveCalls.length, 2);

  // Click into the middle of the code (caret at position 5).
  await act(async () => el.setSelectionRange(5, 5));

  // NEWER save B resolves first: cache stamped "…ab", localCode cleared.
  await act(async () => {
    resolveSaveAt(1);
  });
  assert.equal(el.value, "let x = 1;ab");
  assert.equal(el.selectionStart, 5, "caret survived the in-order stamp");

  // OLDER save A resolves LAST — the bug: stale value stamped with no
  // localCode shadow left to hide it.
  await act(async () => {
    resolveSaveAt(0);
  });
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
  resetStore();
  const m = await mount(useUpdateSlideCode, makeProject("let x = 1;", "s2"), "s2");
  const el = m.el();
  el.focus();

  await type(el, "let x = 1;a", undefined);
  assert.equal(saveCalls.length, 1, "first write starts immediately");

  await type(el, "let x = 1;ab");
  assert.equal(
    saveCalls.length,
    1,
    "second write is held by the queue while the first is in flight",
  );

  await act(async () => el.setSelectionRange(5, 5));
  const snapshot = el;

  // Resolve save A — save B is only released now, in schedule order.
  await act(async () => {
    resolveSaveAt(0);
  });
  assert.equal(saveCalls.length, 2, "second write released after the first resolved");
  assert.equal(saveCalls[1].code, "let x = 1;ab", "DB application order = schedule order");
  // Cache stamped "…a" while localCode is still "…ab" (not cleared — newer
  // edit present), so the editor value is untouched.
  assert.equal(snapshot.value, "let x = 1;ab");
  assert.equal(snapshot.selectionStart, 5, "caret untouched by the shadowed stamp");

  await act(async () => {
    resolveSaveAt(0);
  });
  assert.equal(snapshot.value, "let x = 1;ab", "clearLocalCode → cache transition is same-string");
  assert.equal(snapshot.selectionStart, 5, "caret never moved");
  assert.equal(pendingSaves.length, 0);
  await m.unmount();
});

test("mid-line insertion keeps the caret mid-line (no async involved)", async () => {
  resetApiMocks();
  resetStore();
  const m = await mount(useUpdateSlideCode, makeProject("example", "s3"), "s3");
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
  await act(async () => {
    let guard = 12;
    while ((pendingSaves.length > 0 || saveCalls.length < 2) && guard-- > 0) {
      if (pendingSaves.length) resolveSaveAt(0);
      await Promise.resolve();
    }
  });
  await new Promise((r) => setTimeout(r, 0));
  await m.unmount();
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
