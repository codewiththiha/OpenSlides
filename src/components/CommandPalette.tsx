/**
 * Cmd/Ctrl+K command palette for quick actions.
 */
import { useEffect, useState } from "react";
import { Command } from "cmdk";
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
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useUiStore } from "@/store/useUiStore";
import { THEME_OPTIONS } from "@/types";
import { cn } from "@/lib/utils";
import { modKeyLabel } from "@/lib/platform";
import { isModKey } from "@/lib/keyboard";

interface CommandPaletteProps {
  projectId?: string;
  onExport?: () => void;
  onAddSlide?: () => void;
  onTheme?: (theme: string) => void;
}

export function CommandPalette({
  projectId,
  onExport,
  onAddSlide,
  onTheme,
}: CommandPaletteProps) {
  const navigate = useNavigate();
  const isCommandOpen = useUiStore((s) => s.isCommandOpen);
  const setIsCommandOpen = useUiStore((s) => s.setIsCommandOpen);
  const setIsPresenting = useUiStore((s) => s.setIsPresenting);
  const setIsSettingsOpen = useUiStore((s) => s.setIsSettingsOpen);
  const setIsShortcutsOpen = useUiStore((s) => s.setIsShortcutsOpen);
  const toggleZenMode = useUiStore((s) => s.toggleZenMode);
  const isDarkUi = useUiStore((s) => s.isDarkUi);
  const toggleTheme = useUiStore((s) => s.toggleTheme);
  const [search, setSearch] = useState("");
  const mod = modKeyLabel();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isModKey(e) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsCommandOpen(!isCommandOpen);
      }
      if (e.key === "Escape" && isCommandOpen) {
        setIsCommandOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isCommandOpen, setIsCommandOpen]);

  useEffect(() => {
    if (!isCommandOpen) setSearch("");
  }, [isCommandOpen]);

  if (!isCommandOpen) return null;

  const run = (fn: () => void) => {
    fn();
    setIsCommandOpen(false);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center bg-black/50 pt-[15vh] backdrop-blur-sm">
      <div className="absolute inset-0" onClick={() => setIsCommandOpen(false)} />
      <Command
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-xl border bg-card shadow-2xl"
        label="Command Menu"
      >
        <Command.Input
          value={search}
          onValueChange={setSearch}
          placeholder="Type a command or search…"
          className="w-full border-b bg-transparent px-4 py-3 text-sm outline-none placeholder:text-muted-foreground"
          autoFocus
        />
        <Command.List className="max-h-80 overflow-y-auto p-2">
          <Command.Empty className="px-3 py-6 text-center text-sm text-muted-foreground">
            No results.
          </Command.Empty>

          <Command.Group heading="Navigation" className="text-xs text-muted-foreground">
            <Item
              icon={<Home className="h-4 w-4" />}
              label="Go to Dashboard"
              onSelect={() => run(() => navigate("/"))}
            />
            {projectId && (
              <>
                <Item
                  icon={<MonitorPlay className="h-4 w-4" />}
                  label="Start Presentation"
                  onSelect={() => run(() => setIsPresenting(true))}
                />
                <Item
                  icon={<Settings className="h-4 w-4" />}
                  label="Open Settings"
                  onSelect={() => run(() => setIsSettingsOpen(true))}
                />
                <Item
                  icon={<Focus className="h-4 w-4" />}
                  label="Toggle Zen Mode"
                  onSelect={() => run(() => toggleZenMode())}
                />
                <Item
                  icon={<Plus className="h-4 w-4" />}
                  label="Add Slide"
                  onSelect={() => run(() => onAddSlide?.())}
                />
                <Item
                  icon={<Download className="h-4 w-4" />}
                  label="Export Project JSON"
                  onSelect={() => run(() => onExport?.())}
                />
              </>
            )}
            <Item
              icon={isDarkUi ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              label={isDarkUi ? "Switch to Light UI" : "Switch to Dark UI"}
              onSelect={() => run(() => toggleTheme())}
            />
            <Item
              icon={<Keyboard className="h-4 w-4" />}
              label="Keyboard shortcuts"
              onSelect={() => run(() => setIsShortcutsOpen(true))}
            />
          </Command.Group>

          {projectId && onTheme && (
            <Command.Group heading="Themes" className="mt-2 text-xs text-muted-foreground">
              {THEME_OPTIONS.map((t) => (
                <Item
                  key={t.value}
                  icon={<span className="h-2 w-2 rounded-full bg-primary" />}
                  label={t.label}
                  onSelect={() => run(() => onTheme(t.value))}
                />
              ))}
            </Command.Group>
          )}
        </Command.List>
        <div className="border-t px-3 py-2 text-[10px] text-muted-foreground">
          <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono">Esc</kbd> to close ·{" "}
          <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono">{mod}K</kbd> toggle
        </div>
      </Command>
    </div>
  );
}

function Item({
  icon,
  label,
  onSelect,
}: {
  icon: React.ReactNode;
  label: string;
  onSelect: () => void;
}) {
  return (
    <Command.Item
      onSelect={onSelect}
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground",
        "data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground",
      )}
    >
      {icon}
      <span>{label}</span>
    </Command.Item>
  );
}
