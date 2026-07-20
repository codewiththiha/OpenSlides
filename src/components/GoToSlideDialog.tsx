/** Cmd/Ctrl+G quick jump to a slide by number or name. */
import { useEffect, useState } from "react";
import { Command } from "cmdk";
import { Highlighter as HighlighterIcon } from "lucide-react";
import { useUiStore } from "@/store/useUiStore";
import { slideDisplayName, type Project } from "@/types";
import { cn } from "@/lib/utils";

export function GoToSlideDialog({ project }: { project: Project }) {
  const isOpen = useUiStore((s) => s.isGoToSlideOpen);
  const setIsOpen = useUiStore((s) => s.setIsGoToSlideOpen);
  const setCurrentSlideId = useUiStore((s) => s.setCurrentSlideId);
  const currentSlideId = useUiStore((s) => s.currentSlideId);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (isOpen) setQuery("");
  }, [isOpen]);

  if (!isOpen) return null;

  const go = (id: string) => {
    setCurrentSlideId(id);
    setIsOpen(false);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center bg-black/50 pt-[18vh] backdrop-blur-sm">
      <div className="absolute inset-0" onClick={() => setIsOpen(false)} />
      <Command label="Go to slide" className="relative z-10 w-full max-w-md overflow-hidden rounded-xl border bg-card shadow-2xl">
        <Command.Input
          autoFocus
          value={query}
          onValueChange={setQuery}
          placeholder="Slide number or name…"
          className="w-full border-b bg-transparent px-4 py-3 text-sm outline-none placeholder:text-muted-foreground"
        />
        <Command.List className="max-h-72 overflow-y-auto p-2">
          <Command.Empty className="px-3 py-6 text-center text-sm text-muted-foreground">No matching slide.</Command.Empty>
          <Command.Group className="text-xs text-muted-foreground">
            {project.slides.map((slide, index) => {
              const isCurrent = slide.id === currentSlideId;
              return (
                <Command.Item
                  key={slide.id}
                  value={`${index + 1} ${slideDisplayName(slide, index)}`}
                  onSelect={() => go(slide.id)}
                  className={cn(
                    "flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm text-foreground",
                    "data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground",
                    isCurrent && "bg-primary/5",
                  )}
                >
                  <span className="w-6 shrink-0 text-right font-mono text-[11px] text-muted-foreground">{index + 1}</span>
                  <span className="min-w-0 flex-1 truncate">{slideDisplayName(slide, index)}</span>
                  {slide.highlights.length > 0 && (
                    <span className="flex shrink-0 items-center gap-1 text-[10px] text-amber-400/80">
                      <HighlighterIcon className="h-3 w-3" />
                      {slide.highlights.length}
                    </span>
                  )}
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{(slide.duration / 1000).toFixed(1)}s</span>
                </Command.Item>
              );
            })}
          </Command.Group>
        </Command.List>
        <div className="border-t px-3 py-2 text-[10px] text-muted-foreground">
          <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono">↵</kbd> jump · <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono">Esc</kbd> close
        </div>
      </Command>
    </div>
  );
}
