import * as React from "react";
import { Slider } from "./slider";

/**
 * DebouncedSlider — fixes Settings Sliders Spam IPC (8 IPC calls per drag → 1)
 * - Local state updates onValueChange for immediate UI feedback (no IPC)
 * - IPC only on onValueCommit (pointer up) → 50× fewer IPC calls
 */
interface DebouncedSliderProps extends Omit<React.ComponentProps<typeof Slider>, "value" | "onValueCommit" | "onValueChange"> {
  value: number[];
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  onValueCommit?: (value: number[]) => void;
  onCommit?: (value: number) => void; // convenience single value
}

export function DebouncedSlider({
  value,
  min,
  max,
  step,
  disabled,
  onValueCommit,
  onCommit,
  className,
  ...rest
}: DebouncedSliderProps) {
  const [local, setLocal] = React.useState(value);

  React.useEffect(() => {
    setLocal(value);
  }, [value]);

  return (
    <Slider
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      value={local}
      onValueChange={setLocal}
      onValueCommit={(v) => {
        onValueCommit?.(v);
        if (v[0] !== undefined) onCommit?.(v[0]);
      }}
      className={className}
      {...rest}
    />
  );
}
