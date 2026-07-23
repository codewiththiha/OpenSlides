<script lang="ts">
  /**
   * SaveRaceHarness — models the Svelte CodeEditor's value wiring for the
   * save-race suite (the React-era harness did the same for the controlled
   * React textarea). Mounted by tests/editor-save-race.test.mts.
   *
   * mode "queued":  current wiring — UNCONTROLLED textarea (the Svelte editor
   *                 never writes `value` programmatically after mount), local
   *                 code shadow + the real queued updateSlideCodeMutation hook.
   * mode "prefix":  characterization of the pre-fix bug — CONTROLLED-ish
   *                 textarea (framework re-assigns value on every computed
   *                 change, like the old React component did) + an unqueued
   *                 save path with the exact onSuccess the pre-fix hook had.
   */
  import { createQuery } from "@tanstack/svelte-query";
  import {
    getLocalCode,
    setLocalCode,
    clearLocalCode,
  } from "../../src/shared/stores/slide-code.svelte";
  import { queryClient } from "../../src/shared/queries/query-client";
  import { updateSlideCodeMutation } from "../../src/shared/queries/slides";
  import { api } from "../../src/shared/lib/tauri-api";
  import type { Project } from "../../src/shared/types";

  let { slideId, mode }: { slideId: string; mode: "queued" | "prefix" } =
    $props();

  const query = createQuery(
    () => ({
      queryKey: ["project", "p1"],
      // Tests seed the cache directly; this query exists only to surface
      // onSuccess cache stamps reactively.
      queryFn: () => new Promise<Project>(() => {}),
      staleTime: Infinity,
    }),
    () => queryClient,
  );

  const queued = updateSlideCodeMutation();

  /** Pre-fix save path, kept verbatim: mutationFn fired the IPC directly
   *  (no queue), same onSuccess logic the code shipped with before the fix. */
  function mutateUnqueued(v: { slideId: string; code: string }) {
    void api.updateSlideCode(v.slideId, v.code).then(() => {
      queryClient.setQueriesData<Project>({ queryKey: ["project"] }, (old) => {
        if (!old?.slides?.some((s) => s.id === v.slideId)) return old;
        return {
          ...old,
          slides: old.slides.map((s) =>
            s.id === v.slideId ? { ...s, code: v.code } : s,
          ),
        };
      });
      const current = getLocalCode(v.slideId);
      if (current === undefined || current === v.code) {
        clearLocalCode(v.slideId);
      }
    });
  }

  const slide = $derived(
    query.data?.slides.find((s) => s.id === slideId) ?? query.data?.slides[0],
  );
  const code = $derived(getLocalCode(slideId) ?? slide?.code ?? "");
  // Captured once for the uncontrolled mode — the only programmatic write,
  // mirroring CodeEditor.svelte's mount-time value write.
  // svelte-ignore state_referenced_locally
  const initialCode = code;

  function onInput(e: Event) {
    const v = (e.currentTarget as HTMLTextAreaElement).value;
    setLocalCode(slideId, v);
    if (mode === "queued") queued.mutate({ slideId, code: v });
    else mutateUnqueued({ slideId, code: v });
  }
</script>

{#if query.data}
  {#if mode === "prefix"}
    <textarea value={code} oninput={onInput}></textarea>
  {:else}
    <textarea value={initialCode} oninput={onInput}></textarea>
  {/if}
{/if}
