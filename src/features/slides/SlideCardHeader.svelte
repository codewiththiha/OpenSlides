<script lang="ts">
  import DragHandle from "$lib/ui/DragHandle.svelte";
  import InlineEditableText from "$lib/ui/InlineEditableText.svelte";

  import { consumeSlideCardActions } from "./slide-card-actions.svelte";

  let {
    isRenaming,
    renameValue,
    title,
    slideId,
  }: {
    isRenaming: boolean;
    renameValue: string;
    title: string;
    slideId: string;
  } = $props();

  const cardActions = consumeSlideCardActions();
</script>

<div class="flex min-w-0 items-center justify-between gap-1">
  <div class="flex min-w-0 items-center gap-1">
    <DragHandle
      onclick={(e) => e.stopPropagation()}
      aria-label="Drag to reorder slide"
    />
    {#if isRenaming}
      <InlineEditableText
        value={renameValue}
        onChange={cardActions.setRenameValue}
        onCommit={cardActions.commitRename}
        onCancel={cardActions.cancelRename}
        class="h-5 min-w-0 flex-1 rounded px-1 text-xs font-medium"
      />
    {:else}
      <!-- Rename affordance: same action as the context-menu rename.
           Enter/Space mirrors the double-click for keyboard users. -->
      <span
        class="truncate text-xs font-medium"
        title="{title} — double-click or right-click to rename"
        role="button"
        tabindex="0"
        onkeydown={(e) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault();
          e.stopPropagation();
          cardActions.startRename(slideId, title);
        }}
        ondblclick={(e) => {
          e.stopPropagation();
          cardActions.startRename(slideId, title);
        }}
      >
        {title}
      </span>
    {/if}
  </div>
</div>
