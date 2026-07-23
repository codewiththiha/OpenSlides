<script lang="ts">
  /**
   * Editor route — thin router wrapper.
   *
   * svelte-spa-router passes matched route params as a `params` prop. Keying
   * the inner orchestrator on `projectId` rebuilds all project-scoped state
   * (project query, slide mutations, add-slide) on project switch instead of
   * re-running it against the stale id.
   */
  import EditorInner from "@/features/editor/EditorInner.svelte";

  let { params = {} }: { params?: { projectId?: string } } = $props();
</script>

{#key params.projectId}
  <EditorInner projectId={params.projectId} />
{/key}
