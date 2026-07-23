<script lang="ts">
  import type { HTMLSelectAttributes } from "svelte/elements";
  import { cn } from "@/lib/utils";

  interface SelectFieldProps extends HTMLSelectAttributes {
    options: ReadonlyArray<{ value: string; label: string }>;
    selectSize?: "sm" | "md";
    class?: string;
    value?: string;
    ref?: HTMLSelectElement | null;
  }

  let {
    options,
    selectSize = "sm",
    class: className,
    value = $bindable(),
    ref = $bindable(null),
    ...rest
  }: SelectFieldProps = $props();
</script>

<select
  bind:this={ref}
  bind:value
  class={cn(
    selectSize === "sm" &&
      "h-7 max-w-[9rem] truncate rounded-md border border-input bg-background px-2 text-xs",
    selectSize === "md" &&
      "h-9 w-full rounded-md border border-input bg-background px-3 text-sm",
    className,
  )}
  {...rest}
>
  {#each options as opt (opt.value)}
    <option value={opt.value}>{opt.label}</option>
  {/each}
</select>
