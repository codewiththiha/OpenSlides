<script lang="ts">
  /**
   * Cmd/Ctrl+K command palette for quick actions.
   */
  import { Command } from "bits-ui";
  import type { Snippet } from "svelte";
  import {
    Home,
    MonitorPlay,
    Settings,
    Download,
    Focus,
    Moon,
    Sun,
    Plus,
    Keyboard,
  } from "@lucide/svelte";
  import { push } from "svelte-spa-router";
  import {
    ui,
    setIsCommandOpen,
    setIsPresenting,
    setIsSettingsOpen,
    setIsShortcutsOpen,
    toggleZenMode,
    toggleTheme,
  } from "$lib/stores/ui-state.svelte";
  import { THEME_OPTIONS, type ThemeName } from "$lib/types";
  import { cn } from "$lib/lib/utils";
  import Kbd from "$lib/ui/Kbd.svelte";
  import CommandDialog from "$lib/ui/CommandDialog.svelte";
  import { modKeyLabel } from "$lib/lib/platform";
  import { isModKey } from "$lib/lib/keyboard";

  let {
    projectId,
    onExport,
    onAddSlide,
    onTheme,
  }: {
    projectId?: string;
    onExport?: () => void;
    onAddSlide?: () => void;
    onTheme?: (theme: ThemeName) => void;
  } = $props();

  let search = $state("");
  const mod = modKeyLabel();

  $effect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isModKey(e) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsCommandOpen(!ui.isCommandOpen);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  $effect(() => {
    if (!ui.isCommandOpen) search = "";
  });

  function run(fn: () => void) {
    fn();
    setIsCommandOpen(false);
  }

  const itemClass = cn(
    "flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground",
    // bits-ui marks selection with a presence-only data-selected attribute
    "data-[selected]:bg-accent data-[selected]:text-accent-foreground",
  );
</script>

{#snippet item(icon: Snippet, label: string, onSelect: () => void)}
  <!-- bits-ui needs an explicit value for filtering (cmdk derived it from
       the text content); match cmdk's lowercase normalization. -->
  <Command.Item value={label.toLowerCase()} {onSelect} class={itemClass}>
    {@render icon()}
    <span>{label}</span>
  </Command.Item>
{/snippet}

<CommandDialog
  open={ui.isCommandOpen}
  onClose={() => setIsCommandOpen(false)}
  label="Command Menu"
  placeholder="Type a command or search…"
  bind:search
  class="w-full max-w-lg"
>
  <Command.Group value="navigation" class="text-xs text-muted-foreground">
    <Command.GroupHeading>Navigation</Command.GroupHeading>
    {@render item(homeIcon, "Go to Dashboard", () => run(() => void push("/")))}
    {#if projectId}
      {@render item(presentIcon, "Start Presentation", () =>
        run(() => setIsPresenting(true)),
      )}
      {@render item(settingsIcon, "Open Settings", () =>
        run(() => setIsSettingsOpen(true)),
      )}
      {@render item(focusIcon, "Toggle focus mode", () =>
        run(() => toggleZenMode()),
      )}
      {@render item(plusIcon, "Add Slide", () => run(() => onAddSlide?.()))}
      {@render item(downloadIcon, "Export presentation", () =>
        run(() => onExport?.()),
      )}
    {/if}
    {@render item(
      themeIcon,
      ui.isDarkUi ? "Switch to light mode" : "Switch to dark mode",
      () => run(() => toggleTheme()),
    )}
    {@render item(keyboardIcon, "Keyboard shortcuts", () =>
      run(() => setIsShortcutsOpen(true)),
    )}
  </Command.Group>

  {#if projectId && onTheme}
    <Command.Group value="themes" class="mt-2 text-xs text-muted-foreground">
      <Command.GroupHeading>Themes</Command.GroupHeading>
      {#each THEME_OPTIONS as t (t.value)}
        {@render item(themeDot, t.label, () => run(() => onTheme(t.value)))}
      {/each}
    </Command.Group>
  {/if}

  {#snippet footer()}
    <div class="border-t px-3 py-2 text-[10px] text-muted-foreground">
      <Kbd>Esc</Kbd> to close · <Kbd>{mod}K</Kbd> toggle
    </div>
  {/snippet}
</CommandDialog>

{#snippet homeIcon()}<Home class="h-4 w-4" />{/snippet}
{#snippet presentIcon()}<MonitorPlay class="h-4 w-4" />{/snippet}
{#snippet settingsIcon()}<Settings class="h-4 w-4" />{/snippet}
{#snippet focusIcon()}<Focus class="h-4 w-4" />{/snippet}
{#snippet plusIcon()}<Plus class="h-4 w-4" />{/snippet}
{#snippet downloadIcon()}<Download class="h-4 w-4" />{/snippet}
{#snippet keyboardIcon()}<Keyboard class="h-4 w-4" />{/snippet}
{#snippet themeIcon()}
  {#if ui.isDarkUi}<Sun class="h-4 w-4" />{:else}<Moon class="h-4 w-4" />{/if}
{/snippet}
{#snippet themeDot()}<span class="h-2 w-2 rounded-full bg-primary"
  ></span>{/snippet}
