/**
 * Keyboard shortcuts cheatsheet — open with `?` (Shift+/).
 */
import { X } from "lucide-react";
import { useUiStore } from "@/store/useUiStore";
import { modKeyLabel } from "@/lib/platform";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

const GROUPS: { title: string; items: { keys: string[]; desc: string }[] }[] = [
  {
    title: "General",
    items: [
      { keys: ["mod", "K"], desc: "Command palette" },
      { keys: ["?"], desc: "Show this shortcuts list" },
      { keys: ["Esc"], desc: "Close dialogs / exit present or zen" },
    ],
  },
  {
    title: "Editor",
    items: [
      { keys: ["mod", "Z"], desc: "Undo code edit" },
      { keys: ["mod", "Shift", "Z"], desc: "Redo code edit" },
      { keys: ["mod", "Y"], desc: "Redo (Windows / Linux)" },
      { keys: ["mod", "B"], desc: "Toggle zen mode" },
      { keys: ["←", "→"], desc: "Step through highlights, then slides" },
      { keys: ["Tab"], desc: "Indent (insert 2 spaces)" },
      { keys: ["Shift", "Tab"], desc: "Unindent" },
    ],
  },
  {
    title: "Playback",
    items: [
      { keys: ["Play"], desc: "Toolbar play — auto-advance by slide duration" },
      { keys: ["P"], desc: "Toggle autoplay in presentation mode" },
    ],
  },
  {
    title: "Presentation",
    items: [
      { keys: ["mod", "Shift", "P"], desc: "Start presentation (menu)" },
      { keys: ["←", "→", "Space"], desc: "Step through highlights, then slides" },
      { keys: ["Click"], desc: "Advance one highlight step / slide" },
      { keys: ["Right-click"], desc: "Step back" },
      { keys: ["Esc"], desc: "Exit presentation / fullscreen" },
    ],
  },
  {
    title: "Menu (also in menu bar)",
    items: [
      { keys: ["mod", "N"], desc: "New project" },
      { keys: ["mod", "E"], desc: "Export project JSON" },
      { keys: ["mod", ","], desc: "Project settings" },
      { keys: ["mod", "Shift", "N"], desc: "Add slide" },
    ],
  },
];

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[1.5rem] items-center justify-center rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground shadow-sm">
      {children}
    </kbd>
  );
}

export function ShortcutsHelp() {
  const isShortcutsOpen = useUiStore((s) => s.isShortcutsOpen);
  const setIsShortcutsOpen = useUiStore((s) => s.setIsShortcutsOpen);
  const mod = modKeyLabel();

  if (!isShortcutsOpen) return null;

  const label = (k: string) => (k === "mod" ? mod : k);

  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div
        className="absolute inset-0"
        onClick={() => setIsShortcutsOpen(false)}
      />
      <div
        className={cn(
          "relative z-10 w-full max-w-lg overflow-hidden rounded-xl border bg-card shadow-2xl",
        )}
        role="dialog"
        aria-labelledby="shortcuts-title"
      >
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
    </div>
  );
}
