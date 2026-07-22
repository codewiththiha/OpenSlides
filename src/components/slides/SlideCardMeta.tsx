import { Highlighter as HighlighterIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "../ui/badge";

interface SlideCardMetaProps {
  language: string;
  hlCount: number;
  progress: number;
  isSelected: boolean;
}

export function SlideCardMeta({
  language,
  hlCount,
  progress,
  isSelected,
}: SlideCardMetaProps) {
  return (
    <div className="mt-auto flex items-center justify-between gap-1">
      <span
        className="truncate text-[10px] text-muted-foreground/70"
        title={language}
      >
        {language}
      </span>
      {hlCount > 0 && (
        <span className="relative grid shrink-0 place-items-center">
          <Badge
            variant="primary"
            className={cn(
              "col-start-1 row-start-1 transition-opacity duration-150",
              "group-hover:opacity-0",
              (isSelected || progress >= 0) && "opacity-0",
            )}
          >
            <HighlighterIcon className="h-2.5 w-2.5" />
            {hlCount}
          </Badge>
          <span
            className={cn(
              "col-start-1 row-start-1 inline-flex items-center gap-[3px] rounded bg-primary/10 px-1.5 py-[3px]",
              "opacity-0 transition-opacity duration-150",
              "group-hover:opacity-100",
              (isSelected || progress >= 0) && "opacity-100",
            )}
            title={`${hlCount} highlight${hlCount > 1 ? "s" : ""} — steps through with → before the next slide${
              progress >= 0 ? ` · showing ${progress + 1}/${hlCount}` : ""
            }`}
          >
            <HighlighterIcon
              className={cn(
                "h-2.5 w-2.5 transition-colors",
                progress >= 0 ? "text-primary" : "text-primary/50",
              )}
            />
            {Array.from({ length: Math.min(hlCount, 10) }, (_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 w-1.5 rounded-full transition-all duration-200",
                  i <= progress
                    ? "scale-110 bg-primary"
                    : progress >= 0
                      ? "bg-muted-foreground/25"
                      : "bg-primary/40",
                )}
              />
            ))}
          </span>
        </span>
      )}
    </div>
  );
}
