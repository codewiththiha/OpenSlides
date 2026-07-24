<script lang="ts">
  import { cn } from "$lib/lib/utils";

  export type TwoOption = {
    value: string;
    label: string;
    swatch?: string;
  };

  let {
    value,
    options,
    onCommit,
    onPreview,
    onPreviewEnd,
    ariaLabel,
  }: {
    value: string;
    options: readonly [TwoOption, TwoOption];
    onCommit: (value: string) => void;
    onPreview?: (value: string) => void;
    onPreviewEnd?: () => void;
    ariaLabel: string;
  } = $props();
</script>

<div class="grid grid-cols-2 gap-3" role="radiogroup" aria-label={ariaLabel}>
  {#each options as option (option.value)}
    {@const selected = value === option.value}
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      class="group text-left focus-visible:outline-none"
      onclick={() => onCommit(option.value)}
      onmouseenter={() => onPreview?.(option.value)}
      onmouseleave={onPreviewEnd}
      onfocus={() => onPreview?.(option.value)}
      onblur={onPreviewEnd}
    >
      <span
        class={cn(
          "flex h-10 w-full items-center rounded-lg px-3 text-xs font-semibold shadow-inner transition-transform group-hover:scale-[1.02] group-hover:shadow-md",
          selected
            ? "ring-2 ring-primary ring-offset-2 ring-offset-card"
            : "ring-1 ring-border/50",
        )}
        style="background-color: {option.swatch ?? 'transparent'};"
      >
        <span
          class="rounded bg-background/70 px-1.5 py-0.5 text-foreground shadow-sm backdrop-blur-sm"
        >
          {option.label}
        </span>
      </span>
    </button>
  {/each}
</div>
