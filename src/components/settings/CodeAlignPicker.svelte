<script lang="ts">
  import { cn } from "@/lib/utils";

  let {
    value,
    onChange,
  }: {
    value: string;
    onChange: (value: "left" | "center") => void;
  } = $props();

  const ALIGNS = ["left", "center"] as const;
</script>

<div class="grid grid-cols-2 gap-2">
  {#each ALIGNS as align (align)}
    {@const active = (value ?? "left") === align}
    <button
      type="button"
      onclick={() => onChange(align)}
      class={cn(
        "rounded-md border px-3 py-2 text-left text-sm transition-colors",
        active
          ? "border-primary bg-primary/10 text-foreground"
          : "border-border bg-background hover:bg-muted/50",
      )}
    >
      <div class="font-medium capitalize">{align}</div>
      <div class="mt-0.5 text-[10px] text-muted-foreground">
        {align === "left" ? "Block starts at the left edge" : "Centered on the slide"}
      </div>
    </button>
  {/each}
</div>
