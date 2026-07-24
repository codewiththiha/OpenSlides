<script lang="ts">
  import { Check } from "@lucide/svelte";
  import { availableThemes } from "$lib/lib/themes";
  import type { ThemeName } from "$lib/types";
  import { cn } from "$lib/lib/utils";

  let {
    value,
    onChange,
    onPreviewTheme,
    onClearPreviewTheme,
  }: {
    value: string;
    onChange: (theme: ThemeName) => void;
    onPreviewTheme: (theme: ThemeName) => void;
    onClearPreviewTheme: () => void;
  } = $props();

  const themes = $derived(availableThemes());
</script>

<div class="grid grid-cols-4 gap-3" role="radiogroup" aria-label="Syntax theme">
  {#each themes as theme (theme.value)}
    {@const selected = value === theme.value}
    {@const codeLineClass = theme.light ? "bg-black/25" : "bg-white/30"}
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      class="group min-w-0 text-left focus-visible:outline-none"
      title="Use {theme.label}"
      onclick={() => {
        onClearPreviewTheme();
        onChange(theme.value);
      }}
      onmouseenter={() => onPreviewTheme(theme.value)}
      onmouseleave={onClearPreviewTheme}
      onfocus={() => onPreviewTheme(theme.value)}
      onblur={onClearPreviewTheme}
    >
      <span
        class={cn(
          "relative block h-14 w-full overflow-hidden rounded-xl border-2 border-transparent shadow-sm transition-all group-hover:scale-[1.04] group-hover:shadow-md group-focus-visible:ring-2 group-focus-visible:ring-primary/50 group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-card",
          selected && "border-primary",
        )}
        style="background-color: {theme.background};"
        aria-hidden="true"
      >
        <span class="absolute right-2 bottom-2 left-2 space-y-1">
          <span class={cn("block h-0.5 w-4/5 rounded-full", codeLineClass)}
          ></span>
          <span class={cn("block h-0.5 w-3/5 rounded-full", codeLineClass)}
          ></span>
          <span class={cn("block h-0.5 w-[70%] rounded-full", codeLineClass)}
          ></span>
        </span>
        {#if selected}
          <span
            class="absolute top-1.5 right-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-background/90 text-primary shadow-sm"
          >
            <Check class="h-3.5 w-3.5" />
          </span>
        {/if}
      </span>
      <span
        class="mt-1.5 block truncate text-center text-[10px] text-muted-foreground"
      >
        {theme.label}
      </span>
    </button>
  {/each}
</div>
