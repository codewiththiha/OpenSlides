<script lang="ts">
  /** Visual Shiki theme gallery with live slide preview. */
  import { tick } from "svelte";
  import { Moon, Palette, Sun } from "@lucide/svelte";
  import CodeThumbnail from "$lib/ui/CodeThumbnail.svelte";
  import ThemeTile from "./ThemeTile.svelte";
  import { THEMES } from "$lib/lib/themes";
  import { fallbackForeground, type ThemeName } from "$lib/types";
  import { shikiDisplayHtml } from "$lib/shiki/shiki-display.svelte";
  import { cn } from "$lib/lib/utils";

  const DEFAULT_THEME_SAMPLE = `const makeSlide = (idea: string) => {
  return \`Present: \${idea}\`;
};`;

  type ThemeFilter = "all" | "dark" | "light";

  const FILTERS: {
    value: ThemeFilter;
    label: string;
  }[] = [
    { value: "all", label: "All" },
    { value: "dark", label: "Dark" },
    { value: "light", label: "Light" },
  ];

  let {
    value,
    onChange,
    onPreviewTheme,
    onClearPreviewTheme,
    sampleCode = DEFAULT_THEME_SAMPLE,
  }: {
    value: string;
    onChange: (theme: ThemeName) => void;
    onPreviewTheme: (theme: ThemeName) => void;
    onClearPreviewTheme: () => void;
    sampleCode?: string;
  } = $props();

  let themeFilter = $state<ThemeFilter>("all");
  let focusIndex = $state(0);
  let gridEl: HTMLDivElement | undefined = $state();

  const selected = $derived(
    THEMES.find((theme) => theme.value === value) ?? THEMES[0],
  );
  const sample = $derived(
    sampleCode.trim() ? sampleCode : DEFAULT_THEME_SAMPLE,
  );
  const activeFilterIndex = $derived(
    Math.max(
      0,
      FILTERS.findIndex((filter) => filter.value === themeFilter),
    ),
  );
  const visibleThemes = $derived(
    THEMES.filter((theme) => {
      if (themeFilter === "dark") return !theme.light;
      if (themeFilter === "light") return theme.light;
      return true;
    }),
  );

  const hero = shikiDisplayHtml(() => ({
    code: sample,
    language: "typescript",
    theme: selected.value,
    resetKey: `theme-hero-${selected.value}`,
    priority: "low",
    debounceMs: 40,
    policyName: "previewTile",
  }));

  $effect(() => {
    const selectedIndex = visibleThemes.findIndex(
      (theme) => theme.value === value,
    );
    if (selectedIndex >= 0) {
      focusIndex = selectedIndex;
      return;
    }
    if (focusIndex >= visibleThemes.length) {
      focusIndex = Math.max(0, visibleThemes.length - 1);
    }
  });

  function focusTile(index: number) {
    focusIndex = Math.min(Math.max(index, 0), visibleThemes.length - 1);
    void tick().then(() => {
      gridEl
        ?.querySelector<HTMLButtonElement>(`[data-theme-index="${focusIndex}"]`)
        ?.focus();
    });
  }

  function selectFocusedTheme() {
    const theme = visibleThemes[focusIndex];
    if (theme) onChange(theme.value);
  }

  function handleGridKeydown(event: KeyboardEvent) {
    if (visibleThemes.length === 0) return;

    if (event.key === "ArrowRight") {
      event.preventDefault();
      focusTile(focusIndex + 1);
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusTile(focusIndex - 1);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusTile(focusIndex + 2);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      focusTile(focusIndex - 2);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      focusTile(0);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      focusTile(visibleThemes.length - 1);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectFocusedTheme();
    }
  }
</script>

<div class="space-y-4">
  <div
    class="relative min-h-14 overflow-hidden rounded-xl border border-border/50 p-3 shadow-inner"
    style="background-color: {selected.background}; color: {fallbackForeground(
      selected.value,
    )};"
  >
    <div class="relative z-10 min-w-0 pr-28">
      <div class="text-[10px] font-semibold tracking-wide uppercase opacity-70">
        Current theme
      </div>
      <div class="mt-1 truncate text-sm font-semibold">{selected.label}</div>
    </div>
    <CodeThumbnail
      html={hero.html}
      theme={selected.value}
      fontSize={5.25}
      lineHeight={1.35}
      class="absolute inset-y-1 right-2 w-28 rounded-lg border border-white/10 p-1 opacity-75"
      codeClassName="!absolute left-2 top-1/2 !inline-block -translate-y-1/2"
    >
      {#snippet fallback()}
        <span class="font-mono text-[9px] opacity-70">···</span>
      {/snippet}
    </CodeThumbnail>
  </div>

  <div
    role="tablist"
    aria-label="Filter themes"
    class="relative grid h-9 grid-cols-3 rounded-full bg-muted p-1"
  >
    <span
      class="absolute top-1 bottom-1 left-1 rounded-full bg-background shadow-sm motion-safe:transition-transform motion-safe:duration-200 motion-reduce:transition-none"
      style="width: calc((100% - 0.5rem) / 3); transform: translateX({activeFilterIndex *
        100}%);"
      aria-hidden="true"
    ></span>
    {#each FILTERS as filter (filter.value)}
      {@const active = themeFilter === filter.value}
      <button
        type="button"
        role="tab"
        aria-selected={active}
        class={cn(
          "relative z-10 inline-flex items-center justify-center gap-1.5 rounded-full text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-card focus-visible:outline-none",
          active
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground",
        )}
        onclick={() => {
          themeFilter = filter.value;
        }}
      >
        {#if filter.value === "all"}
          <Palette class="h-3.5 w-3.5" />
        {:else if filter.value === "dark"}
          <Moon class="h-3.5 w-3.5" />
        {:else}
          <Sun class="h-3.5 w-3.5" />
        {/if}
        {filter.label}
      </button>
    {/each}
  </div>

  <div
    bind:this={gridEl}
    role="radiogroup"
    aria-label="Syntax theme"
    tabindex="-1"
    class="grid grid-cols-2 gap-2.5"
    onkeydown={handleGridKeydown}
  >
    {#each visibleThemes as theme, index (theme.value)}
      <ThemeTile
        value={theme.value}
        label={theme.label}
        background={theme.background}
        selected={value === theme.value}
        {sample}
        dataIndex={index}
        tabIndex={focusIndex === index ? 0 : -1}
        onSelect={() => onChange(theme.value)}
        onPreview={() => onPreviewTheme(theme.value)}
        onPreviewEnd={onClearPreviewTheme}
      />
    {/each}
  </div>
</div>
