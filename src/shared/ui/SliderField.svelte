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
</script>

<div class={cn("min-w-0 space-y-1", disabled && "opacity-45", className)}>
  <div class="flex items-center justify-between">
    <Label
      class={cn(
        "block truncate text-[10px] text-muted-foreground",
        labelClassName,
      )}
      title={label}
    >
      {label}
    </Label>
    <!-- Visible value badge -->
    <span
      class="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-foreground tabular-nums"
    >
      {format ? format(value) : value}
    </span>
  </div>
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
