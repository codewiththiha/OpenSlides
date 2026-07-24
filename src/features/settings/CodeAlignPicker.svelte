<script lang="ts">
  import { cn } from "$lib/lib/utils";

  let {
    value,
    onChange,
  }: {
    value: string;
    onChange: (value: "left" | "center") => void;
  } = $props();

  const ALIGNS = ["left", "center"] as const;
</script>

<div
  class="grid grid-cols-2 rounded-lg bg-muted/40 p-1"
  role="radiogroup"
  aria-label="Code alignment"
>
  {#each ALIGNS as align (align)}
    {@const active = (value ?? "left") === align}
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onclick={() => onChange(align)}
      class={cn(
        "rounded-md px-3 py-2 text-sm font-medium capitalize transition-colors focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-card focus-visible:outline-none",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {align}
    </button>
  {/each}
</div>
