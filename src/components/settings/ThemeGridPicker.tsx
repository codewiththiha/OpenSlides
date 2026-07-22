import { Check, ChevronDown, Palette } from "lucide-react";
import { useState } from "react";
import { CodeThumbnail } from "../ui/code-thumbnail";
import { useShikiHtml } from "@/hooks/useShikiHtml";
import { THEMES } from "@/lib/themes";
import type { ThemeName } from "@/types";
import { cn } from "@/lib/utils";

const THEME_SAMPLE = `const makeSlide = (idea: string) => {
  return \`Present: ${"${idea}"}\`;
};`;

function ThemeTile({
  value,
  label,
  selected,
  onSelect,
}: {
  value: ThemeName;
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const html = useShikiHtml({
    code: THEME_SAMPLE,
    language: "typescript",
    theme: value,
    priority: "low",
    debounceMs: 40,
  });

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group relative overflow-hidden rounded-lg border text-left transition-all duration-150",
        selected
          ? "border-primary ring-2 ring-primary/35"
          : "border-border/70 hover:border-primary/50 hover:-translate-y-0.5",
      )}
      title={`Use ${label}`}
      aria-pressed={selected}
    >
      <CodeThumbnail
        html={html}
        theme={value}
        fontSize={5.5}
        lineHeight={1.35}
        className="h-[72px] w-full p-2"
        codeClassName="flex h-full items-center justify-center text-center"
        fallback={<span className="block text-center font-mono text-[9px] text-muted-foreground">···</span>}
      />
      <div className="flex items-center justify-between bg-card px-2 py-1.5">
        <span className="truncate text-[10px] font-medium">{label}</span>
        {selected && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
      </div>
    </button>
  );
}

/** A compact theme control that opens the visual Shiki theme gallery on demand. */
export function ThemeGridPicker({ value, onChange }: { value: string; onChange: (theme: ThemeName) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const selected = THEMES.find((theme) => theme.value === value) ?? THEMES[0];

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="flex w-full items-center justify-between rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50"
        aria-expanded={isOpen}
      >
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full border border-black/10" style={{ backgroundColor: selected.background }} />
          <span>{selected.label}</span>
        </span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Palette className="h-3.5 w-3.5" />
          Browse themes
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-180")} />
        </span>
      </button>

      {isOpen && (
        <div className="grid grid-cols-2 gap-2">
          {THEMES.map((theme) => (
            <ThemeTile
              key={theme.value}
              value={theme.value}
              label={theme.label}
              selected={value === theme.value}
              onSelect={() => {
                onChange(theme.value);
                setIsOpen(false);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
