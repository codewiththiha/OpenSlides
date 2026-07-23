<script lang="ts">
  import ToggleField from "$lib/ui/ToggleField.svelte";
  import SliderField from "$lib/ui/SliderField.svelte";
  import type { ProjectSettings } from "$lib/types";

  let {
    settings,
    effTransition,
    effStagger,
    onPreview,
    onCommit,
  }: {
    settings: ProjectSettings;
    effTransition: number;
    effStagger: number;
    onPreview: (
      key: "globalTransitionDuration" | "globalStagger",
      value: number,
    ) => void;
    onCommit: (partial: Record<string, unknown>) => void;
  } = $props();
</script>

<ToggleField
  label="Use global transition"
  checked={settings.useGlobalTransition}
  onChange={(v) => onCommit({ useGlobalTransition: v })}
/>
{#if settings.useGlobalTransition}
  <div>
    <SliderField
      label="Transition"
      labelClassName="text-xs text-muted-foreground"
      value={effTransition}
      min={100}
      max={2000}
      step={50}
      format={(v) => `${v}ms`}
      onPreview={(v) => onPreview("globalTransitionDuration", v)}
      onCommit={(v) => onCommit({ globalTransitionDuration: v })}
    />
  </div>
{/if}

<ToggleField
  label="Use global stagger"
  checked={settings.useGlobalStagger}
  onChange={(v) => onCommit({ useGlobalStagger: v })}
/>
{#if settings.useGlobalStagger}
  <div>
    <SliderField
      label="Stagger"
      labelClassName="text-xs text-muted-foreground"
      value={effStagger}
      min={0}
      max={50}
      step={1}
      onPreview={(v) => onPreview("globalStagger", v)}
      onCommit={(v) => onCommit({ globalStagger: v })}
    />
  </div>
{/if}
