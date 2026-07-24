<script lang="ts" module>
  let nextToggleId = 0;
</script>

<script lang="ts">
  import Label from "./Label.svelte";
  import Switch from "./Switch.svelte";
  import { cn } from "$lib/lib/utils";

  let {
    label,
    checked,
    onChange,
    disabled,
    labelClassName,
  }: {
    label: string;
    checked: boolean;
    onChange: (value: boolean) => void;
    disabled?: boolean;
    labelClassName?: string;
  } = $props();

  const switchId = `toggle-field-${nextToggleId++}`;
  const labelId = `${switchId}-label`;
</script>

<div class="flex items-center justify-between gap-3">
  <Label
    id={labelId}
    for={switchId}
    class={cn(
      "min-w-0 cursor-pointer truncate text-sm transition-colors",
      checked ? "text-foreground" : "text-muted-foreground",
      labelClassName,
    )}
  >
    {label}
  </Label>
  <Switch
    id={switchId}
    {checked}
    onCheckedChange={onChange}
    {disabled}
    aria-labelledby={labelId}
  />
</div>
