<script lang="ts">
  /**
   * CodeEditorHost — mount wrapper for the REAL CodeEditor in the jsdom
   * typing suite. Feeds the project from the app query cache EXACTLY like
   * EditorInner.svelte does (useProject → prop), so onSuccess cache stamps
   * flow in as fresh slide objects while tests control resolution order.
   */
  import { createQuery } from "@tanstack/svelte-query";
  import CodeEditor from "../../src/features/editor/CodeEditor.svelte";
  import { queryClient } from "../../src/shared/queries/query-client";
  import type { Project } from "../../src/shared/types";

  let { project }: { project: Project } = $props();

  const query = createQuery(
    () => ({
      queryKey: ["project", project.id],
      // Tests seed the cache before mounting; this exists so onSuccess
      // stamps propagate reactively. It never fetches.
      queryFn: () => new Promise<Project>(() => {}),
      staleTime: Infinity,
    }),
    () => queryClient,
  );
</script>

{#if query.data}
  <CodeEditor project={query.data} />
{/if}
