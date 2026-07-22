import { Check } from "lucide-react";
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
  background,
  selected,
  onSelect,
}: {
  value: ThemeName;
  label: string;
  background: string;
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
        fallback={<span className="block font-mono text-[9px]" style={{ color: background }}>···</span>}
      />
      <div className="flex items-center justify-between bg-card px-2 py-1.5">
        <span className="truncate text-[10px] font-medium">{label}</span>
        {selected && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
      </div>
    </button>
  );
}

/** Visual theme chooser with real Shiki-rendered code for every option. */
export function ThemeGridPicker({ value, onChange }: { value: string; onChange: (theme: ThemeName) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {THEMES.map((theme) => (
        <ThemeTile
          key={theme.value}
          value={theme.value}
          label={theme.label}
          background={theme.background}
          selected={value === theme.value}
          onSelect={() => onChange(theme.value)}
        />
      ))}
    </div>
  );
}
