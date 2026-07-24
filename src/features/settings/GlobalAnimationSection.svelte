<script lang="ts">
  import ToggleField from "$lib/ui/ToggleField.svelte";
  import SliderField from "$lib/ui/SliderField.svelte";
  import type { ProjectSettings } from "$lib/types";
  import type { GlobalAnimationKey } from "$lib/stores/types";

  let {
    settings,
    effTransition,
    effStagger,
    effGlobalDimAmount,
    effGlobalSizeUpAmount,
    onPreview,
    onCommit,
  }: {
    settings: ProjectSettings;
    effTransition: number;
    effStagger: number;
    effGlobalDimAmount: number;
    effGlobalSizeUpAmount: number;
    onPreview: (key: GlobalAnimationKey, value: number | string) => void;
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

<!-- NEW: Global highlight controls -->
<ToggleField
  label="Use global highlight"
  checked={settings.useGlobalHighlight}
  onChange={(v) => onCommit({ useGlobalHighlight: v })}
/>
{#if settings.useGlobalHighlight}
  <div class="space-y-2 pt-1">
    <p class="text-[10px] text-muted-foreground">
      Applies to all highlights. Individual highlight sliders are disabled.
    </p>

    <SliderField
      label="Global dim amount"
      labelClassName="text-xs text-muted-foreground"
      value={effGlobalDimAmount}
      min={0}
      max={100}
      step={5}
      format={(v) => `${v}%`}
      onPreview={(v) => onPreview("globalDimAmount", v)}
      onCommit={(v) => onCommit({ globalDimAmount: v })}
    />

    <SliderField
      label="Global pop-up size"
      labelClassName="text-xs text-muted-foreground"
      value={effGlobalSizeUpAmount}
      min={100}
      max={250}
      step={5}
      format={(v) => `${v}%`}
      onPreview={(v) => onPreview("globalSizeUpAmount", v)}
      onCommit={(v) => onCommit({ globalSizeUpAmount: v })}
    />
  </div>
{/if}
