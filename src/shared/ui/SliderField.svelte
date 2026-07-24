<script lang="ts" module>
  let nextSliderId = 0;
</script>

<script lang="ts">
  import { untrack } from "svelte";
  import { fade } from "svelte/transition";
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

  const sliderId = `slider-field-${nextSliderId++}`;
  const labelId = `${sliderId}-label`;

  let liveValue = $state(untrack(() => value));
  let isInteracting = $state(false);
  let commitFlash = $state(false);
  let flashTimer: ReturnType<typeof setTimeout> | undefined;

  const reduceMotion = $derived(
    typeof window !== "undefined" &&
      "matchMedia" in window &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  $effect(() => {
    liveValue = value;
  });

  $effect(() => {
    return () => {
      if (flashTimer) clearTimeout(flashTimer);
    };
  });

  const displayValue = $derived(format ? format(liveValue) : String(liveValue));
  const text = $derived(`${label} (${displayValue})`);
  const thumbPercent = $derived(
    Math.min(100, Math.max(0, ((liveValue - min) / (max - min)) * 100)),
  );

  function flashCommitBadge() {
    commitFlash = true;
    if (flashTimer) clearTimeout(flashTimer);
    flashTimer = setTimeout(() => {
      commitFlash = false;
    }, 300);
  }
</script>

<div class={cn("min-w-0 space-y-2", disabled && "opacity-45", className)}>
  <div class="flex items-center justify-between gap-3">
    <Label
      id={labelId}
      for={sliderId}
      class={cn(
        "block truncate text-[10px] text-muted-foreground",
        labelClassName,
      )}
      title={text}
    >
      {label}
    </Label>
    <span
      class={cn(
        "shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium transition-colors",
        commitFlash ? "text-primary" : "text-muted-foreground",
      )}
      aria-hidden="true"
    >
      {displayValue}
    </span>
  </div>

  <div class="relative pt-3">
    {#if isInteracting}
      <span
        class="pointer-events-none absolute -top-3 z-10 -translate-x-1/2 rounded bg-foreground px-1.5 py-0.5 text-[10px] leading-none font-medium whitespace-nowrap text-background shadow-sm"
        style:left={`${thumbPercent}%`}
        transition:fade={{ duration: reduceMotion ? 0 : 80 }}
      >
        {displayValue}
      </span>
    {/if}

    <DebouncedSlider
      id={sliderId}
      aria-labelledby={labelId}
      {min}
      {max}
      {step}
      {disabled}
      value={[value]}
      onValueChange={([v]) => {
        if (v !== undefined) {
          liveValue = v;
          isInteracting = true;
          onPreview?.(v);
        }
      }}
      onValueCommit={([v]) => {
        if (v !== undefined) {
          liveValue = v;
          isInteracting = false;
          flashCommitBadge();
          onCommit(v);
        }
      }}
    />
  </div>
</div>
