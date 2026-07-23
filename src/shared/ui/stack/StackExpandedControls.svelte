<script lang="ts">
  /**
   * StackExpandedControls — shared expanded controls for fanned stacks
   * (`Ungroup (n)` + close `X` buttons).
   */
  import { Ungroup, X } from "@lucide/svelte";
  import Button from "../Button.svelte";
  import { cn } from "$lib/lib/utils";

  let {
    count,
    onUngroup,
    onClose,
    variant = "dashboard",
    class: className,
  }: {
    count: number;
    onUngroup: () => void;
    onClose: () => void;
    variant?: "dashboard" | "slide-strip";
    class?: string;
  } = $props();
</script>

{#if variant === "slide-strip"}
  <div
    class={cn("flex flex-col gap-1 border-r border-border/60 pr-2", className)}
  >
    <Button
      variant="ghost"
      size="sm"
      class="h-6 gap-1 px-2 text-[11px] font-semibold text-primary hover:bg-primary/20"
      onclick={onUngroup}
      title="Ungroup slide section"
    >
      <Ungroup class="h-3 w-3" />
      Ungroup
    </Button>
    <Button
      variant="ghost"
      size="icon"
      class="h-6 w-6 self-center text-muted-foreground hover:text-foreground"
      onclick={onClose}
      title="Collapse section fan"
    >
      <X class="h-3.5 w-3.5" />
    </Button>
  </div>
{:else}
  <div class={cn("flex items-center gap-3", className)}>
    <Button
      size="sm"
      variant="secondary"
      class="gap-2 rounded-full border border-border bg-card px-5 py-2 shadow-xl hover:bg-accent hover:text-accent-foreground"
      onclick={onUngroup}
    >
      <Ungroup class="h-4 w-4" />
      Ungroup ({count})
    </Button>
    <Button
      size="icon"
      variant="outline"
      class="h-9 w-9 rounded-full border border-border bg-card shadow-xl hover:bg-accent"
      onclick={onClose}
      aria-label="Close stack fan"
    >
      <X class="h-4 w-4" />
    </Button>
  </div>
{/if}
