import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

interface InlineEditableTextProps {
  value: string;
  onChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  /** ProjectCard style: show Check + X buttons next to the input */
  withButtons?: boolean;
  /** Disables the confirm button when withButtons is true */
  commitBusy?: boolean;
  /** Input classes */
  className?: string;
  /** Button sizing when withButtons is true */
  buttonSize?: "sm" | "md";
  /**
   * Whether click events on the rename area stop propagation.
   * Default true — rename clicks must not select the parent card.
   */
  stopPropagation?: boolean;
}

const input =
  "rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-1 focus:ring-ring";

export function InlineEditableText({
  value,
  onChange,
  onCommit,
  onCancel,
  withButtons = false,
  commitBusy = false,
  className,
  buttonSize = "md",
  stopPropagation = true,
}: InlineEditableTextProps) {
  const inputEl = (
    <input
      autoFocus
      className={cn(input, withButtons ? "h-8 flex-1 min-w-0" : "h-7 w-full", className)}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onClick={(e) => stopPropagation && e.stopPropagation()}
      onBlur={onCommit}
      onKeyDown={(e) => {
        if (stopPropagation) e.stopPropagation();
        if (e.key === "Enter") onCommit();
        if (e.key === "Escape") onCancel();
      }}
    />
  );

  if (withButtons) {
    return (
      <div
        className="flex items-center gap-1"
        onClick={(e) => stopPropagation && e.stopPropagation()}
      >
        {inputEl}
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "shrink-0",
            buttonSize === "sm" && "h-5 w-5 [&_svg]:size-3",
            buttonSize === "md" && "h-8 w-8",
          )}
          onMouseDown={(event) => event.preventDefault()}
          onClick={onCommit}
          disabled={commitBusy}
        >
          <Check className="text-emerald-500" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "shrink-0",
            buttonSize === "sm" && "h-5 w-5 [&_svg]:size-3",
            buttonSize === "md" && "h-8 w-8",
          )}
          onMouseDown={(event) => event.preventDefault()}
          onClick={onCancel}
        >
          <X />
        </Button>
      </div>
    );
  }

  return inputEl;
}
