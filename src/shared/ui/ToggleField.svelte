<script lang="ts" module>
  let nextToggleId = 0;
</script>

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

  const switchId = `toggle-field-${nextToggleId++}`;
  const labelId = `${switchId}-label`;
  const descriptionId = `${switchId}-description`;
</script>

<div class="flex items-center justify-between gap-3">
  <div class="min-w-0">
    <Label
      id={labelId}
      for={switchId}
      class={cn(
        "cursor-pointer text-sm transition-colors",
        checked ? "text-foreground" : "text-muted-foreground",
        labelClassName,
      )}
    >
      {label}
    </Label>
    {#if description}
      <p
        id={descriptionId}
        class={cn(
          "mt-0.5 text-[11px] leading-snug transition-colors",
          checked ? "text-muted-foreground" : "text-muted-foreground/50",
        )}
      >
        {description}
      </p>
    {/if}
  </div>
  <Switch
    id={switchId}
    {checked}
    onCheckedChange={onChange}
    {disabled}
    aria-labelledby={labelId}
    aria-describedby={description ? descriptionId : undefined}
  />
</div>
