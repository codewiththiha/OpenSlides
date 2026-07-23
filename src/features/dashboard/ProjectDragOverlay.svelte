<script lang="ts">
  /**
   * Drag overlay (§6.7): the non-interactive clone that follows the pointer
   * during a project-dnd session. Portal'd to body; reads the shared
   * project-dnd manager directly so it needs no props.
   */
  import ProjectCard from "./ProjectCard.svelte";
  import StackDeck from "$lib/ui/stack/StackDeck.svelte";
  import { portal } from "$lib/actions/portal";
  import { projectDnd } from "@/features/dashboard/project-dnd.svelte";
  import { PROJECT_CARD_WIDTH } from "./layout";

  const session = $derived(projectDnd.session);
  const dragWidth = $derived(session?.width ?? null);
</script>

{#if session?.active}
  <div use:portal>
    <div
      class="pointer-events-none fixed rotate-2 cursor-grabbing opacity-90 shadow-2xl"
      style="z-index: 999; left: {session.originLeft + (session.x - session.startX)}px; top: {session.originTop +
        (session.y - session.startY)}px;"
    >
      {#if session.payload.kind === "fan-item"}
        <div style="width: {dragWidth ?? PROJECT_CARD_WIDTH}px;">
          <ProjectCard project={session.payload.project} static />
        </div>
      {:else if session.payload.chunk.items.length > 1}
        <StackDeck
          count={session.payload.chunk.items.length}
          class="pointer-events-none"
          style="width: {dragWidth ?? undefined}px;"
        >
          <ProjectCard project={session.payload.chunk.items[0]} static />
        </StackDeck>
      {:else if session.payload.chunk.items[0]}
        <div style="width: {dragWidth ?? undefined}px;">
          <ProjectCard project={session.payload.chunk.items[0]} static />
        </div>
      {/if}
    </div>
  </div>
{/if}
