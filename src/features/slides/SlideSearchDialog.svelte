<script lang="ts" module>
  export type SearchScope = "slides" | "code";
</script>

<script lang="ts">
  /** Centered find control that leaves the workspace visible behind it. */
  import { Search } from "@lucide/svelte";
  import { fade } from "svelte/transition";
  import { Z_INDEX } from "$lib/ui/Overlay.svelte";
  import { modKeyLabel } from "$lib/lib/platform";
  import { EASE_DIM } from "$lib/lib/easings";

  let {
    open,
    query,
    scope,
    onQueryChange,
    onScopeChange,
    onSubmitCodeSearch,
    onClose,
  }: {
    open: boolean;
    query: string;
    scope: SearchScope;
    onQueryChange: (value: string) => void;
    onScopeChange: (scope: SearchScope) => void;
    onSubmitCodeSearch: () => void;
    onClose: () => void;
  } = $props();

  let inputEl = $state<HTMLInputElement | null>(null);

  function rise(
    _node: Element,
    { duration = 150, easing = EASE_DIM }: { duration?: number; easing?: (t: number) => number } = {},
  ) {
    return {
      duration,
      easing,
      css: (t: number) =>
        `opacity: ${t}; transform: translateY(${8 * (1 - t)}px) scale(${0.98 + 0.02 * t});`,
    };
  }

  $effect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => inputEl?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "Enter" && scope === "code") onSubmitCodeSearch();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
    };
  });
</script>

{#if open}
  <div
    class="fixed inset-0 flex items-center justify-center p-4"
    style="z-index: {Z_INDEX.command};"
    transition:fade={{ duration: 150, easing: EASE_DIM }}
  >
    <button type="button" class="absolute inset-0 cursor-default" aria-label="Close search" onclick={onClose}></button>
    <div
      class="relative w-full max-w-lg overflow-hidden rounded-xl border bg-card shadow-2xl"
      transition:rise={{}}
    >
      <div class="flex items-center gap-2 border-b px-4 py-3">
        <Search class="h-4 w-4 text-muted-foreground" />
        <input
          bind:this={inputEl}
          value={query}
          oninput={(event) => onQueryChange(event.currentTarget.value)}
          placeholder={scope === "slides"
            ? "Find slides by name or code…"
            : "Find in the current editor…"}
          class="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <span class="text-[10px] text-muted-foreground">{modKeyLabel()}F</span>
      </div>
      <div class="flex items-center gap-2 px-4 py-3 text-xs">
        <span class="mr-1 text-muted-foreground">Search</span>
        <label class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted">
          <input
            type="radio"
            name="search-scope"
            checked={scope === "slides"}
            onchange={() => onScopeChange("slides")}
          />
          Slides
        </label>
        <label class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted">
          <input
            type="radio"
            name="search-scope"
            checked={scope === "code"}
            onchange={() => onScopeChange("code")}
          />
          Code editor
        </label>
        <span class="ml-auto text-[10px] text-muted-foreground">
          {scope === "code" ? "Enter to find" : "Results update below"}
        </span>
      </div>
    </div>
  </div>
{/if}
