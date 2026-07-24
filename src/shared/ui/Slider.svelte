<script lang="ts">
  import { Slider } from "bits-ui";
  import { cn } from "$lib/lib/utils";

  let {
    value = $bindable([50]),
    min = 0,
    max = 100,
    step = 1,
    disabled = false,
    onValueChange,
    onValueCommit,
    class: className,
    ref = $bindable(null),
    ...rest
  }: {
    id?: string;
    value?: number[];
    min?: number;
    max?: number;
    step?: number;
    disabled?: boolean;
    onValueChange?: (value: number[]) => void;
    onValueCommit?: (value: number[]) => void;
    class?: string;
    ref?: HTMLSpanElement | null;
    "aria-labelledby"?: string;
    "aria-label"?: string;
  } = $props();
</script>

<Slider.Root
  bind:ref
  type="multiple"
  bind:value
  {min}
  {max}
  {step}
  {disabled}
  {onValueChange}
  {onValueCommit}
  class={cn(
    "relative flex w-full touch-none items-center select-none",
    disabled && "cursor-not-allowed opacity-50",
    className,
  )}
  {...rest}
>
  <!-- bits-ui v2: no Track subcomponent — the track is a plain span inside
       the Root's children snippet, and Thumb requires its `index`. -->
  {#snippet children({ thumbs })}
    <span
      class="relative h-1.5 w-full grow overflow-hidden rounded-full bg-primary/20"
    >
      <Slider.Range class="absolute h-full bg-primary" />
    </span>
    {#each thumbs as thumb (thumb)}
      <Slider.Thumb
        index={thumb}
        class="block h-4 w-4 rounded-full border border-primary/50 bg-background shadow transition-colors focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-card focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
      />
    {/each}
  {/snippet}
</Slider.Root>
