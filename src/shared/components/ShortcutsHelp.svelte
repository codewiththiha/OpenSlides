<script lang="ts">
  /**
   * Keyboard shortcuts cheatsheet — open with `?` (Shift+/).
   */
  import { X } from "@lucide/svelte";
  import { ui, setIsShortcutsOpen } from "$lib/stores/ui-state.svelte";
  import { modKeyLabel } from "$lib/lib/platform";
  import { SHORTCUTS } from "$lib/lib/shortcuts";
  import Button from "$lib/ui/Button.svelte";
  import Kbd from "$lib/ui/Kbd.svelte";
  import Overlay, { Z_INDEX } from "$lib/ui/Overlay.svelte";
  import { focusTrap } from "$lib/actions/focus-trap";

  const GROUPS: {
    title: string;
    items: { keys: readonly string[]; desc: string }[];
  }[] = [
    {
      title: "General",
      items: [
        {
          keys: [...SHORTCUTS.commandPalette.keys],
          desc: SHORTCUTS.commandPalette.description,
        },
        {
          keys: [...SHORTCUTS.shortcutsHelp.keys],
          desc: SHORTCUTS.shortcutsHelp.description,
        },
        {
          keys: ["Esc"],
          desc: "Close dialogs / exit presentation or focus mode",
        },
      ],
    },
    {
      title: "Editor",
      items: [
        { keys: [...SHORTCUTS.undo.keys], desc: SHORTCUTS.undo.description },
        { keys: [...SHORTCUTS.redo.keys], desc: SHORTCUTS.redo.description },
        { keys: ["mod", "Y"], desc: "Redo (Windows)" },
        { keys: [...SHORTCUTS.zen.keys], desc: SHORTCUTS.zen.description },
        {
          keys: [...SHORTCUTS.goToSlide.keys],
          desc: SHORTCUTS.goToSlide.description,
        },
        {
          keys: [...SHORTCUTS.focusSlideSearch.keys],
          desc: SHORTCUTS.focusSlideSearch.description,
        },
        { keys: ["←", "→"], desc: "Step through highlights, then slides" },
        { keys: ["1", "…", "9"], desc: "Jump directly to highlight step 1-9" },
        { keys: ["0"], desc: "Back to the full slide (no highlight)" },
        {
          keys: ["Click a dot"],
          desc: "Jump to a highlight by clicking its dot",
        },
        { keys: ["Tab"], desc: "Indent (insert 2 spaces)" },
        { keys: ["Shift", "Tab"], desc: "Unindent" },
      ],
    },
    {
      title: "Playback",
      items: [
        { keys: ["Play"], desc: "Play — slides advance automatically" },
        { keys: ["P"], desc: "Toggle autoplay in presentation mode" },
      ],
    },
    {
      title: "Presentation",
      items: [
        {
          keys: [...SHORTCUTS.present.keys],
          desc: SHORTCUTS.present.description,
        },
        {
          keys: ["←", "→", "Space"],
          desc: "Step through highlights, then slides",
        },
        { keys: ["1", "…", "9"], desc: "Jump directly to highlight step 1-9" },
        { keys: ["0"], desc: "Back to the full slide (no highlight)" },
        { keys: ["Click"], desc: "Advance one highlight step / slide" },
        {
          keys: ["Click a dot"],
          desc: "Jump to a highlight by clicking its dot",
        },
        { keys: ["Right-click"], desc: "Step back" },
        { keys: ["Esc"], desc: "Exit presentation / fullscreen" },
      ],
    },
    {
      title: "Menu (also in menu bar)",
      items: [
        {
          keys: [...SHORTCUTS.newProject.keys],
          desc: SHORTCUTS.newProject.description,
        },
        {
          keys: [...SHORTCUTS.export.keys],
          desc: SHORTCUTS.export.description,
        },
        {
          keys: [...SHORTCUTS.settings.keys],
          desc: SHORTCUTS.settings.description,
        },
        {
          keys: [...SHORTCUTS.addSlide.keys],
          desc: SHORTCUTS.addSlide.description,
        },
        {
          keys: [...SHORTCUTS.duplicateSlide.keys],
          desc: SHORTCUTS.duplicateSlide.description,
        },
      ],
    },
  ];

  const mod = modKeyLabel();
  const label = (k: string) => (k === "mod" ? mod : k);
</script>

{#if ui.isShortcutsOpen}
  <Overlay
    onClose={() => setIsShortcutsOpen(false)}
    z={Z_INDEX.shortcuts}
    closeOnEsc
    class="w-full max-w-lg"
  >
    <div
      use:focusTrap
      class="overflow-hidden rounded-xl border bg-card shadow-2xl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
    >
      <div class="flex items-center justify-between border-b px-4 py-3">
        <h2 id="shortcuts-title" class="text-sm font-semibold">
          Keyboard shortcuts
        </h2>
        <Button
          variant="ghost"
          size="icon"
          class="h-8 w-8"
          onclick={() => setIsShortcutsOpen(false)}
        >
          <X class="h-4 w-4" />
        </Button>
      </div>

      <div class="max-h-[70vh] space-y-5 overflow-y-auto p-4">
        {#each GROUPS as group (group.title)}
          <section>
            <h3
              class="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase"
            >
              {group.title}
            </h3>
            <ul class="space-y-2">
              {#each group.items as item (item.desc)}
                <li class="flex items-center justify-between gap-4 text-sm">
                  <span class="text-foreground/90">{item.desc}</span>
                  <span
                    class="flex shrink-0 flex-wrap items-center justify-end gap-1"
                  >
                    {#each item.keys as k, i (`${k}-${i}`)}
                      <span class="contents">
                        {#if i > 0}
                          <span class="text-[10px] text-muted-foreground"
                            >+</span
                          >
                        {/if}
                        <Kbd>{label(k)}</Kbd>
                      </span>
                    {/each}
                  </span>
                </li>
              {/each}
            </ul>
          </section>
        {/each}
      </div>

      <div class="border-t px-4 py-2 text-[10px] text-muted-foreground">
        Press <Kbd>?</Kbd> or <Kbd>Esc</Kbd> to close
      </div>
    </div>
  </Overlay>
{/if}
