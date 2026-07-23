<script lang="ts">
  /**
   * Editor route — thin router wrapper.
   *
   * svelte-spa-router passes matched route params as a `params` prop. Keying
   * the inner orchestrator on `projectId` rebuilds all project-scoped hooks
   * (project query, slide mutations, add-slide) on project switch — the
   * Svelte equivalent of React Router re-rendering the component with new
   * params (hooks there closed over the new id on each render).
   */
  import EditorInner from "@/features/editor/EditorInner.svelte";

  let { params = {} }: { params?: { projectId?: string } } = $props();
</script>

{#key params.projectId}
  <EditorInner projectId={params.projectId} />
{/key}
