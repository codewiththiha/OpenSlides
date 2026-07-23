<script lang="ts">
  import Label from "./Label.svelte";
  import DebouncedSlider from "./DebouncedSlider.svelte";
  import { cn } from "$lib/lib/utils";

  let {
    label,
    value,
    min,
    max,
    step,
    format,
    disabled,
    onPreview,
    onCommit,
    class: className,
    labelClassName,
  }: {
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    format?: (value: number) => string;
    disabled?: boolean;
    onPreview?: (value: number) => void;
    onCommit: (value: number) => void;
    class?: string;
    labelClassName?: string;
  } = $props();

  const text = $derived(`${label} (${format ? format(value) : value})`);
</script>

<div class={cn("min-w-0 space-y-1", disabled && "opacity-45", className)}>
  <Label
    class={cn(
      "block truncate text-[10px] text-muted-foreground",
      labelClassName,
    )}
    title={text}
  >
    {text}
  </Label>
  <DebouncedSlider
    {min}
    {max}
    {step}
    {disabled}
    value={[value]}
    onValueChange={([v]) => {
      if (v !== undefined) onPreview?.(v);
    }}
    onValueCommit={([v]) => {
      if (v !== undefined) onCommit(v);
    }}
  />
</div>
