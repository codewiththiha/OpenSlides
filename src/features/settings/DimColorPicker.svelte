<script lang="ts">
  import { cn } from "$lib/lib/utils";
  import { themeBackground } from "$lib/lib/themes";

  let {
    value,
    theme,
    onCommit,
  }: {
    value: "black" | "theme";
    theme: string;
    onCommit: (v: "black" | "theme") => void;
  } = $props();

  const themeBg = $derived(themeBackground(theme));
</script>

<div class="space-y-1.5">
  <span class="text-xs text-muted-foreground">Dim color</span>

  <div
    class="grid grid-cols-2 gap-1 rounded-lg border border-border/60 bg-muted/20 p-1"
    role="radiogroup"
    aria-label="Highlight dim color"
  >
    <button
      type="button"
      role="radio"
      aria-checked={value === "black"}
      onclick={() => onCommit("black")}
      class={cn(
        "flex items-center gap-2 rounded-md px-3 py-2 text-xs transition-all",
        value === "black"
          ? "bg-background font-medium shadow-sm ring-1 ring-border"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <span
        class="h-4 w-4 rounded-full border border-white/20 bg-black shadow-inner"
      ></span>
      Black
    </button>

    <button
      type="button"
      role="radio"
      aria-checked={value === "theme"}
      onclick={() => onCommit("theme")}
      class={cn(
        "flex items-center gap-2 rounded-md px-3 py-2 text-xs transition-all",
        value === "theme"
          ? "bg-background font-medium shadow-sm ring-1 ring-border"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <span
        class="h-4 w-4 rounded-full border border-white/20 shadow-inner"
        style="background-color: {themeBg};"
      ></span>
      Theme BG
    </button>
  </div>

  <p class="text-[10px] text-muted-foreground">
    "Theme BG" uses the current code theme's background color.
  </p>
</div>
