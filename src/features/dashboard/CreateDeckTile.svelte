<script lang="ts">
  import { Loader2, Plus, X } from "@lucide/svelte";
  import { NEW_PRESENTATION_CODE } from "$lib/constants";
  import Button from "$lib/ui/Button.svelte";
  import Input from "$lib/ui/Input.svelte";
  import CodeThumbnail from "$lib/ui/CodeThumbnail.svelte";
  import { shikiDisplayHtml } from "$lib/shiki/shiki-display.svelte";
  import { THEMES } from "$lib/lib/themes";
  import { cn } from "$lib/lib/utils";

  let {
    isExpanded,
    onToggleExpand,
    name,
    onNameChange,
    selectedTheme,
    onThemeChange,
    onCreate,
    isPending,
    class: className,
    isStandalone = false,
  }: {
    isExpanded: boolean;
    onToggleExpand: (expanded: boolean) => void;
    name: string;
    onNameChange: (name: string) => void;
    selectedTheme: string;
    onThemeChange: (theme: string) => void;
    onCreate: () => void;
    isPending: boolean;
    class?: string;
    isStandalone?: boolean;
  } = $props();

  let inputEl = $state<HTMLInputElement | null>(null);

  const preview = shikiDisplayHtml(() => ({
    code: NEW_PRESENTATION_CODE,
    language: "typescript",
    theme: selectedTheme || "dark-plus",
    resetKey: "create-deck-preview",
    debounceMs: 80,
    policyName: "previewTile",
  }));

  $effect(() => {
    if (isExpanded && inputEl) {
      inputEl.focus();
    }
  });

  function onTileKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onToggleExpand(true);
    }
  }
</script>

{#if !isExpanded}
  <div
    role="button"
    tabindex="0"
    onclick={() => onToggleExpand(true)}
    onkeydown={onTileKeyDown}
    class={cn(
      "group flex h-full min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-card/40 p-6 text-center transition-all duration-200 hover:border-primary/60 hover:bg-card/80 hover:shadow-md",
      className,
    )}
    aria-label="Create new presentation"
  >
    <div class="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary transition-transform duration-200 group-hover:scale-110">
      <Plus class="h-5 w-5" />
    </div>
    <h3 class="text-sm font-semibold text-foreground">New Presentation</h3>
    <p class="mt-1 text-xs text-muted-foreground">Click or press Enter to start</p>
  </div>
{:else}
  <div
    class={cn(
      "animate-in fade-in-0 zoom-in-95 rounded-xl border border-primary/40 bg-card p-5 shadow-lg transition-all duration-300",
      isStandalone ? "mb-8" : "mb-6",
      className,
    )}
  >
    <div class="mb-4 flex items-center justify-between border-b border-border/40 pb-3">
      <div>
        <h3 class="text-base font-semibold text-foreground">Create New Presentation</h3>
        <p class="text-xs text-muted-foreground">
          Configure your deck theme and starting slide preview
        </p>
      </div>
      {#if !isStandalone}
        <Button
          variant="ghost"
          size="icon"
          class="h-7 w-7 text-muted-foreground hover:text-foreground"
          onclick={() => onToggleExpand(false)}
          aria-label="Collapse create tile"
        >
          <X class="h-4 w-4" />
        </Button>
      {/if}
    </div>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <!-- Left Column: Form Controls -->
      <div class="flex flex-col justify-between gap-5 lg:col-span-5">
        <div class="space-y-4">
          <div>
            <label for="create-deck-name" class="mb-1.5 block text-xs font-medium text-foreground">
              Presentation Name
            </label>
            <Input
              id="create-deck-name"
              bind:ref={inputEl}
              value={name}
              oninput={(e) => onNameChange(e.currentTarget.value)}
              onkeydown={(e) => {
                if (e.key === "Enter") onCreate();
                if (e.key === "Escape" && !isStandalone) onToggleExpand(false);
              }}
              placeholder="Untitled Presentation"
              class="w-full"
            />
          </div>

          <div>
            <span class="mb-1.5 block text-xs font-medium text-foreground">
              Theme Color Palette ({THEMES.find((t) => t.value === (selectedTheme || "dark-plus"))
                ?.label || "Dark+"})
            </span>
            <div class="flex flex-wrap gap-2 pt-1">
              {#each THEMES as t (t.value)}
                {@const isSelected = (selectedTheme || "dark-plus") === t.value}
                <button
                  type="button"
                  onclick={() => onThemeChange(t.value)}
                  title={t.label}
                  class={cn(
                    "h-5 w-5 rounded-full border border-border/80 transition-all duration-150 hover:scale-125 focus:outline-none",
                    isSelected
                      ? "scale-110 ring-2 ring-primary ring-offset-2 ring-offset-background"
                      : "opacity-80 hover:opacity-100",
                  )}
                  style="background-color: {t.background};"
                  aria-label="Select theme {t.label}"
                ></button>
              {/each}
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2 pt-2">
          <Button onclick={onCreate} disabled={isPending} class="gap-2">
            {#if isPending}
              <Loader2 class="h-4 w-4 animate-spin" />
            {/if}
            Create Presentation
          </Button>
          {#if !isStandalone}
            <Button variant="ghost" onclick={() => onToggleExpand(false)}>Cancel</Button>
          {/if}
        </div>
      </div>

      <!-- Right Column: Live Shiki Preview -->
      <div class="flex flex-col lg:col-span-7">
        <span class="mb-1.5 block text-xs font-medium text-foreground">
          Live Starting Slide Preview
        </span>
        <div class="relative flex-1 rounded-lg border border-border/60 bg-background/50 p-1">
          <CodeThumbnail
            html={preview.html}
            theme={selectedTheme || "dark-plus"}
            fontSize={7.5}
            lineHeight={1.4}
            class="h-44 w-full rounded-md border border-border/40 p-3 shadow-inner"
          />
        </div>
      </div>
    </div>
  </div>
{/if}
