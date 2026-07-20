/** Compact editor slide stepper. Navigation side effects stay in CodeEditor. */
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../ui/button";

export function EditorSlideNav({
  index,
  total,
  onNavigate,
}: {
  index: number;
  total: number;
  onNavigate: (direction: -1 | 1) => void;
}) {
  return (
    <div className="flex min-w-0 items-center gap-0.5">
      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" disabled={index <= 0} onClick={() => onNavigate(-1)}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="shrink-0 text-center text-[10px] text-muted-foreground/80">{index + 1}/{total}</span>
      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" disabled={index >= total - 1} onClick={() => onNavigate(1)}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
