<script lang="ts">
  import { untrack } from "svelte";
  import Slider from "./Slider.svelte";

  /**
   * DebouncedSlider — fixes slider IPC spam (8 IPC calls per drag → 1)
   * but now supports instant preview via onValueChange.
   *
   * - Local state for thumb position (immediate)
   * - onValueChange (instant) → updates the preview rune store for live SlidePreview
   * - onValueCommit (pointer up) → fires Tauri IPC + TanStack Query + clears preview sync
   */
  let {
    value,
    min,
    max,
    step,
    disabled,
    onValueChange,
    onValueCommit,
    onChange,
    onCommit,
    class: className,
    ...rest
  }: {
    value: number[];
    min?: number;
    max?: number;
    step?: number;
    disabled?: boolean;
    /** Instant update (drag) — for preview rune state */
    onValueChange?: (value: number[]) => void;
    /** DB commit (pointer up) — for IPC */
    onValueCommit?: (value: number[]) => void;
    /** Convenience single-value callbacks */
    onChange?: (value: number) => void;
    onCommit?: (value: number) => void;
    class?: string;
  } = $props();

  // Initial value only — the effect above re-syncs `local` with every
  // external value change. untrack() marks the capture as deliberate.
  let local = $state<number[]>(untrack(() => value));

  // Sync from parent when the external value changes (project switch, DB update)
  $effect(() => {
    local = value;
  });

  function handleValueChange(v: number[]) {
    onValueChange?.(v);
    if (v[0] !== undefined) onChange?.(v[0]);
  }

  function handleCommit(v: number[]) {
    onValueCommit?.(v);
    if (v[0] !== undefined) onCommit?.(v[0]);
  }
</script>

<Slider
  {min}
  {max}
  {step}
  {disabled}
  bind:value={local}
  onValueChange={handleValueChange}
  onValueCommit={handleCommit}
  class={className}
  {...rest}
/>
