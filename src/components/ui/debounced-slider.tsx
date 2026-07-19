import * as React from "react";
import { Slider } from "./slider";

/**
 * DebouncedSlider — fixes slider IPC spam (8 IPC calls per drag → 1)
 * but now supports instant preview via onValueChange.
 *
 * - Local state for thumb position (immediate)
 * - onValueChange (instant) → updates Zustand preview store for live SlidePreview
 * - onValueCommit (pointer up) → fires Tauri IPC + React-Query + clears preview sync
 *
 * Before: SlidePreview read DB cache (only updated on commit) → felt laggy.
 * After:  SlidePreview reads previewProject/previewSlides/previewHighlights overrides.
 */
interface DebouncedSliderProps extends Omit<
  React.ComponentProps<typeof Slider>,
  "value" | "onValueCommit" | "onValueChange" | "onChange"
> {
  value: number[];
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  /** Instant update (drag) — for preview Zustand */
  onValueChange?: (value: number[]) => void;
  /** DB commit (pointer up) — for IPC */
  onValueCommit?: (value: number[]) => void;
  /** Convenience single-value callbacks */
  onChange?: (value: number) => void;
  onCommit?: (value: number) => void;
}

export function DebouncedSlider({
  value,
  min,
  max,
  step,
  disabled,
  onValueChange,
  onValueCommit,
  onChange,
  onCommit,
  className,
  ...rest
}: DebouncedSliderProps) {
  const [local, setLocal] = React.useState(value);

  // Sync from parent when external value changes (project switch, DB update)
  // But don't blow away local drag value if we're currently dragging and external is stale.
  // Simple heuristic: if local differs from value by more than step tolerance and we're not actively receiving new DB sync?
  // For now, straightforward sync: when value prop changes, update local.
  React.useEffect(() => {
    setLocal(value);
  }, [value]);

  const handleValueChange = (v: number[]) => {
    setLocal(v);
    onValueChange?.(v);
    if (v[0] !== undefined) onChange?.(v[0]);
  };

  const handleCommit = (v: number[]) => {
    onValueCommit?.(v);
    if (v[0] !== undefined) onCommit?.(v[0]);
  };

  return (
    <Slider
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      value={local}
      onValueChange={handleValueChange}
      onValueCommit={handleCommit}
      className={className}
      {...rest}
    />
  );
}
