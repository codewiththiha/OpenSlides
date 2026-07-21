import { ToggleField } from "../ui/toggle-field";
import { SliderField } from "../ui/slider-field";
import type { ProjectSettings } from "@/types";

interface GlobalAnimationSectionProps {
  settings: ProjectSettings;
  effTransition: number;
  effStagger: number;
  onPreview: (key: "globalTransitionDuration" | "globalStagger", value: number) => void;
  onCommit: (partial: Record<string, unknown>) => void;
}

export function GlobalAnimationSection({
  settings,
  effTransition,
  effStagger,
  onPreview,
  onCommit,
}: GlobalAnimationSectionProps) {
  return (
    <>
      <ToggleField
        label="Use global transition"
        checked={settings.useGlobalTransition}
        onChange={(v) => onCommit({ useGlobalTransition: v })}
      />
      {settings.useGlobalTransition && (
        <div>
          <SliderField
            label="Transition"
            labelClassName="text-xs text-muted-foreground"
            value={effTransition}
            min={100}
            max={2000}
            step={50}
            format={(v) => `${v}ms`}
            onPreview={(v) => onPreview("globalTransitionDuration", v)}
            onCommit={(v) => onCommit({ globalTransitionDuration: v })}
          />
        </div>
      )}

      <ToggleField
        label="Use global stagger"
        checked={settings.useGlobalStagger}
        onChange={(v) => onCommit({ useGlobalStagger: v })}
      />
      {settings.useGlobalStagger && (
        <div>
          <SliderField
            label="Stagger"
            labelClassName="text-xs text-muted-foreground"
            value={effStagger}
            min={0}
            max={50}
            step={1}
            onPreview={(v) => onPreview("globalStagger", v)}
            onCommit={(v) => onCommit({ globalStagger: v })}
          />
        </div>
      )}
    </>
  );
}
