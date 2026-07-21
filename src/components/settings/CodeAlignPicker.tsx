import { cn } from "@/lib/utils";

interface CodeAlignPickerProps {
  value: string;
  onChange: (value: "left" | "center") => void;
}

export function CodeAlignPicker({ value, onChange }: CodeAlignPickerProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {(["left", "center"] as const).map((align) => {
        const active = (value ?? "left") === align;
        return (
          <button
            key={align}
            type="button"
            onClick={() => onChange(align)}
            className={cn(
              "rounded-md border px-3 py-2 text-left text-sm transition-colors",
              active
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border bg-background hover:bg-muted/50",
            )}
          >
            <div className="font-medium capitalize">{align}</div>
            <div className="mt-0.5 text-[10px] text-muted-foreground">
              {align === "left"
                ? "Block starts at the left edge"
                : "Centered on the slide"}
            </div>
          </button>
        );
      })}
    </div>
  );
}
