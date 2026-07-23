<script lang="ts">
  import DragHandle from "../ui/DragHandle.svelte";
  import InlineEditableText from "../ui/InlineEditableText.svelte";

  let {
    isRenaming,
    renameValue,
    title,
    onRenameValueChange,
    onCommitRename,
    onCancelRename,
    onRename,
    slideId,
  }: {
    isRenaming: boolean;
    renameValue: string;
    title: string;
    onRenameValueChange?: (v: string) => void;
    onCommitRename?: () => void;
    onCancelRename?: () => void;
    onRename?: (id: string, current: string) => void;
    slideId: string;
  } = $props();
</script>

<div class="flex min-w-0 items-center justify-between gap-1">
  <div class="flex min-w-0 items-center gap-1">
    <DragHandle onclick={(e) => e.stopPropagation()} aria-label="Drag to reorder slide" />
    {#if isRenaming}
      <InlineEditableText
        value={renameValue}
        onChange={(v) => onRenameValueChange?.(v)}
        onCommit={() => onCommitRename?.()}
        onCancel={() => onCancelRename?.()}
        class="h-5 min-w-0 flex-1 rounded px-1 text-xs font-medium"
      />
    {:else}
      <span
        class="truncate text-xs font-medium"
        title="{title} — double-click or right-click to rename"
        ondblclick={(e) => {
          if (!onRename) return;
          e.stopPropagation();
          onRename(slideId, title);
        }}
      >
        {title}
      </span>
    {/if}
  </div>
</div>
