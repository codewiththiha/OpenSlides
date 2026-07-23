<script lang="ts">
  // NOTE: cmdk-sv's `Command` export is a namespace — the root component is
  // `Command.Root` (bare `<Command>` only worked via cmdk's React CJS shape).
  import { Command } from "cmdk-sv";
  import type { Snippet } from "svelte";
  import Overlay, { OVERLAY_Z } from "./Overlay.svelte";

  let {
    open,
    onClose,
    label,
    placeholder,
    search = $bindable(""),
    listClassName = "max-h-80 overflow-y-auto p-2",
    emptyText = "No results.",
    footer,
    class: className,
    children,
  }: {
    open: boolean;
    onClose: () => void;
    label: string;
    placeholder?: string;
    search?: string;
    listClassName?: string;
    emptyText?: string;
    footer?: Snippet;
    class?: string;
    children?: Snippet;
  } = $props();
</script>

{#if open}
  <Overlay onClose={onClose} z={OVERLAY_Z.command} placement="top" closeOnEsc class={className}>
    <Command.Root {label} class="w-full overflow-hidden rounded-xl border bg-card shadow-2xl">
      <Command.Input
        autofocus
        bind:value={search}
        {placeholder}
        class="w-full border-b bg-transparent px-4 py-3 text-sm outline-none placeholder:text-muted-foreground"
      />
      <Command.List class={listClassName}>
        <Command.Empty class="px-3 py-6 text-center text-sm text-muted-foreground">
          {emptyText}
        </Command.Empty>
        {@render children?.()}
      </Command.List>
      {@render footer?.()}
    </Command.Root>
  </Overlay>
{/if}
