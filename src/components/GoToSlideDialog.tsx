/** Cmd/Ctrl+G quick jump to a slide by number or name. */
import { useEffect, useState } from "react";
import { Command } from "cmdk";
import { Highlighter as HighlighterIcon } from "lucide-react";
import { useUiStore } from "@/store/useUiStore";
import { slideDisplayName, type Project } from "@/types";
import { cn } from "@/lib/utils";
import { Kbd } from "./ui/kbd";
import { CommandDialog } from "./ui/command-dialog";

export function GoToSlideDialog({ project }: { project: Project }) {
  const isOpen = useUiStore((s) => s.isGoToSlideOpen);
  const setIsOpen = useUiStore((s) => s.setIsGoToSlideOpen);
  const setCurrentSlideId = useUiStore((s) => s.setCurrentSlideId);
  const currentSlideId = useUiStore((s) => s.currentSlideId);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (isOpen) setQuery("");
  }, [isOpen]);

  const go = (id: string) => {
    setCurrentSlideId(id);
    setIsOpen(false);
  };

  return (
    <CommandDialog
      open={isOpen}
      onClose={() => setIsOpen(false)}
      label="Go to slide"
      placeholder="Slide number or name…"
      search={query}
      onSearchChange={setQuery}
      listClassName="max-h-72 overflow-y-auto p-2"
      emptyText="No matching slide."
      className="w-full max-w-md"
      footer={
        <div className="border-t px-3 py-2 text-[10px] text-muted-foreground">
          <Kbd>↵</Kbd> jump · <Kbd>Esc</Kbd> close
        </div>
      }
    >
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
    </CommandDialog>
  );
}
