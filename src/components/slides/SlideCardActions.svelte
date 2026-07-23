<script lang="ts">
  import { Pencil, Copy, Trash2 } from "lucide-svelte";
  import HoverActions from "../ui/HoverActions.svelte";
  import HoverActionButton from "../ui/HoverActionButton.svelte";

  let {
    isRenaming,
    title,
    slideId,
    onRename,
    onDuplicate,
    onRemove,
  }: {
    isRenaming: boolean;
    title: string;
    slideId: string;
    onRename?: (id: string, current: string) => void;
    onDuplicate?: (id: string) => void;
    onRemove?: (id: string) => void;
  } = $props();
</script>

{#if !isRenaming}
  <HoverActions>
    {#if onRename}
      <HoverActionButton
        size="sm"
        title="Rename slide"
        onclick={(e) => {
          e.stopPropagation();
          onRename(slideId, title);
        }}
      >
        <Pencil class="h-3 w-3" />
      </HoverActionButton>
    {/if}
    {#if onDuplicate}
      <HoverActionButton
        size="sm"
        title="Duplicate slide (Cmd+Shift+D)"
        onclick={(e) => {
          e.stopPropagation();
          onDuplicate(slideId);
        }}
      >
        <Copy class="h-3 w-3" />
      </HoverActionButton>
    {/if}
    {#if onRemove}
      <HoverActionButton
        size="sm"
        destructive
        onclick={(e) => {
          e.stopPropagation();
          onRemove(slideId);
        }}
      >
        <Trash2 class="h-3 w-3" />
      </HoverActionButton>
    {/if}
  </HoverActions>
{/if}
