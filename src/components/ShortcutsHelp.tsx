/**
 * Keyboard shortcuts cheatsheet — open with `?` (Shift+/).
 */
import { X } from "lucide-react";
import { useUiStore } from "@/store/useUiStore";
import { modKeyLabel } from "@/lib/platform";
import { SHORTCUTS } from "@/lib/shortcuts";
import { Button } from "./ui/button";
import { Kbd } from "./ui/kbd";
import { Overlay, OVERLAY_Z } from "./ui/overlay";

const GROUPS: { title: string; items: { keys: readonly string[]; desc: string }[] }[] = [
  {
    title: "General",
    items: [
      { keys: [...SHORTCUTS.commandPalette.keys], desc: SHORTCUTS.commandPalette.description },
      { keys: [...SHORTCUTS.shortcutsHelp.keys], desc: SHORTCUTS.shortcutsHelp.description },
      { keys: ["Esc"], desc: "Close dialogs / exit presentation or focus mode" },
    ],
  },
  {
    title: "Editor",
    items: [
      { keys: [...SHORTCUTS.undo.keys], desc: SHORTCUTS.undo.description },
      { keys: [...SHORTCUTS.redo.keys], desc: SHORTCUTS.redo.description },
      { keys: ["mod", "Y"], desc: "Redo (Windows)" },
      { keys: [...SHORTCUTS.zen.keys], desc: SHORTCUTS.zen.description },
      { keys: [...SHORTCUTS.goToSlide.keys], desc: SHORTCUTS.goToSlide.description },
      { keys: [...SHORTCUTS.focusSlideSearch.keys], desc: SHORTCUTS.focusSlideSearch.description },
      { keys: ["←", "→"], desc: "Step through highlights, then slides" },
      { keys: ["1", "…", "9"], desc: "Jump directly to highlight step 1-9" },
      { keys: ["0"], desc: "Back to the full slide (no highlight)" },
      { keys: ["Click a dot"], desc: "Jump to a highlight by clicking its dot" },
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
      { keys: [...SHORTCUTS.present.keys], desc: SHORTCUTS.present.description },
      { keys: ["←", "→", "Space"], desc: "Step through highlights, then slides" },
      { keys: ["1", "…", "9"], desc: "Jump directly to highlight step 1-9" },
      { keys: ["0"], desc: "Back to the full slide (no highlight)" },
      { keys: ["Click"], desc: "Advance one highlight step / slide" },
      { keys: ["Click a dot"], desc: "Jump to a highlight by clicking its dot" },
      { keys: ["Right-click"], desc: "Step back" },
      { keys: ["Esc"], desc: "Exit presentation / fullscreen" },
    ],
  },
  {
    title: "Menu (also in menu bar)",
    items: [
      { keys: [...SHORTCUTS.newProject.keys], desc: SHORTCUTS.newProject.description },
      { keys: [...SHORTCUTS.export.keys], desc: SHORTCUTS.export.description },
      { keys: [...SHORTCUTS.settings.keys], desc: SHORTCUTS.settings.description },
      { keys: [...SHORTCUTS.addSlide.keys], desc: SHORTCUTS.addSlide.description },
      { keys: [...SHORTCUTS.duplicateSlide.keys], desc: SHORTCUTS.duplicateSlide.description },
    ],
  },
];

export function ShortcutsHelp() {
  const isShortcutsOpen = useUiStore((s) => s.isShortcutsOpen);
  const setIsShortcutsOpen = useUiStore((s) => s.setIsShortcutsOpen);
  const mod = modKeyLabel();

  if (!isShortcutsOpen) return null;

  const label = (k: string) => (k === "mod" ? mod : k);

  return (
    <Overlay onClose={() => setIsShortcutsOpen(false)} z={OVERLAY_Z.shortcuts} closeOnEsc className="w-full max-w-lg">
      <div className="overflow-hidden rounded-xl border bg-card shadow-2xl" role="dialog" aria-labelledby="shortcuts-title">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 id="shortcuts-title" className="text-sm font-semibold">
            Keyboard shortcuts
          </h2>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setIsShortcutsOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="max-h-[70vh] space-y-5 overflow-y-auto p-4">
          {GROUPS.map((group) => (
            <section key={group.title}>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {group.title}
              </h3>
              <ul className="space-y-2">
                {group.items.map((item) => (
                  <li
                    key={item.desc}
                    className="flex items-center justify-between gap-4 text-sm"
                  >
                    <span className="text-foreground/90">{item.desc}</span>
                    <span className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                      {item.keys.map((k, i) => (
                        <span key={`${k}-${i}`} className="contents">
                          {i > 0 && (
                            <span className="text-[10px] text-muted-foreground">+</span>
                          )}
                          <Kbd>{label(k)}</Kbd>
                        </span>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="border-t px-4 py-2 text-[10px] text-muted-foreground">
          Press <Kbd>?</Kbd> or <Kbd>Esc</Kbd> to close
        </div>
      </div>
    </Overlay>
  );
}
