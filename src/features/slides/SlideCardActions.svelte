<script lang="ts">
  import { Pencil, Copy, Trash2 } from "@lucide/svelte";
  import HoverActions from "$lib/ui/HoverActions.svelte";
  import HoverActionButton from "$lib/ui/HoverActionButton.svelte";
  import { consumeSlideCardActions } from "./slide-card-actions.svelte";

  let {
    isRenaming,
    title,
    slideId,
  }: {
    isRenaming: boolean;
    title: string;
    slideId: string;
  } = $props();

  const cardActions = consumeSlideCardActions();
</script>

{#if !isRenaming}
  <HoverActions>
    <HoverActionButton
      size="sm"
      title="Rename slide"
      onclick={(e) => {
        e.stopPropagation();
        cardActions.startRename(slideId, title);
      }}
    >
      <Pencil class="h-3 w-3" />
    </HoverActionButton>
    <HoverActionButton
      size="sm"
      title="Duplicate slide (Cmd+Shift+D)"
      onclick={(e) => {
        e.stopPropagation();
        cardActions.duplicate(slideId);
      }}
    >
      <Copy class="h-3 w-3" />
    </HoverActionButton>
    <HoverActionButton
      size="sm"
      destructive
      title="Delete slide"
      onclick={(e) => {
        e.stopPropagation();
        cardActions.remove(slideId);
      }}
    >
      <Trash2 class="h-3 w-3" />
    </HoverActionButton>
  </HoverActions>
{/if}
