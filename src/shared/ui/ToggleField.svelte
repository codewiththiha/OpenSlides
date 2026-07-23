<script lang="ts">
  import Label from "./Label.svelte";
  import Switch from "./Switch.svelte";
  import { cn } from "$lib/lib/utils";

  let {
    label,
    description,
    checked,
    onChange,
    disabled,
    labelClassName,
  }: {
    label: string;
    description?: string;
    checked: boolean;
    onChange: (value: boolean) => void;
    disabled?: boolean;
    labelClassName?: string;
  } = $props();
</script>

<div class="flex items-center justify-between gap-3">
  <div class="min-w-0">
    <Label class={cn("text-sm", labelClassName)}>{label}</Label>
    {#if description}
      <p class="text-[11px] text-muted-foreground">{description}</p>
    {/if}
  </div>
  <Switch {checked} onCheckedChange={onChange} {disabled} />
</div>
