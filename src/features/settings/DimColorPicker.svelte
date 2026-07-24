<script lang="ts">
  import { Check } from "@lucide/svelte";
  import { cn } from "$lib/lib/utils";
  import { fallbackForeground, themeBackground } from "$lib/types";

  let {
    value,
    theme,
    onPreview,
    onPreviewEnd,
    onCommit,
  }: {
    value: "black" | "theme";
    theme: string;
    onPreview?: (v: "black" | "theme") => void;
    onPreviewEnd?: () => void;
    onCommit: (v: "black" | "theme") => void;
  } = $props();

  const themeBg = $derived(themeBackground(theme));
  const themeFg = $derived(fallbackForeground(theme));

  const OPTIONS = [
    {
      value: "black",
      label: "Black",
      description: "Cinematic matte",
    },
    {
      value: "theme",
      label: "Theme",
      description: "Blend with code bg",
    },
  ] as const;
</script>

<div
  class="grid grid-cols-2 gap-3"
  role="radiogroup"
  aria-label="Highlight dim color"
>
  {#each OPTIONS as option (option.value)}
    {@const selected = value === option.value}
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onclick={() => onCommit(option.value)}
      onmouseenter={() => onPreview?.(option.value)}
      onmouseleave={onPreviewEnd}
      onfocus={() => onPreview?.(option.value)}
      onblur={onPreviewEnd}
      class={cn(
        "group rounded-xl border border-border/60 bg-background/40 p-2 text-center transition-all hover:border-primary/50 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-card focus-visible:outline-none",
        selected && "border-primary bg-primary/5",
      )}
    >
      <span
        class={cn(
          "relative mx-auto flex h-12 w-12 items-center justify-center rounded-lg border shadow-inner transition-transform group-hover:scale-105",
          selected
            ? "ring-2 ring-primary ring-offset-2 ring-offset-card"
            : "ring-0",
          option.value === "black"
            ? "border-white/10 bg-black text-white"
            : "border-black/10 bg-[var(--swatch-bg)] text-[var(--swatch-fg)]",
        )}
        style="--swatch-bg: {themeBg}; --swatch-fg: {themeFg};"
        aria-hidden="true"
      >
        {#if selected}
          <Check class="h-4 w-4" />
        {/if}
      </span>
      <span class="mt-2 block text-[10px] font-semibold text-foreground">
        {option.label}
      </span>
      <span
        class="mt-0.5 block text-[10px] leading-tight text-muted-foreground/70"
      >
        {option.description}
      </span>
    </button>
  {/each}
</div>
