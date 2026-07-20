import { Label } from "./label";
import { DebouncedSlider } from "./debounced-slider";
import { cn } from "@/lib/utils";

export function SliderField({ label, value, min, max, step, format, disabled, onPreview, onCommit, className, labelClassName }: { label: string; value: number; min: number; max: number; step: number; format?: (value: number) => string; disabled?: boolean; onPreview?: (value: number) => void; onCommit: (value: number) => void; className?: string; labelClassName?: string }) {
  const text = `${label} (${format ? format(value) : value})`;
  return <div className={cn("min-w-0 space-y-1", disabled && "opacity-45", className)}><Label className={cn("block truncate text-[10px] text-muted-foreground", labelClassName)} title={text}>{text}</Label><DebouncedSlider min={min} max={max} step={step} disabled={disabled} value={[value]} onValueChange={([v]) => onPreview?.(v)} onValueCommit={([v]) => onCommit(v)} /></div>;
}
