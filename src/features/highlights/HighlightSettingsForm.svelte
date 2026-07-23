<script lang="ts">
  import { setPreviewHighlightSetting } from "$lib/stores/ui-state.svelte";
  import { previewHighlightSettings } from "@/features/settings/preview-settings";
  import SliderField from "$lib/ui/SliderField.svelte";
  import ToggleField from "$lib/ui/ToggleField.svelte";
  import type { Highlight } from "$lib/types";

  let {
    highlight,
    onUpdate,
  }: {
    highlight: Highlight;
    onUpdate: (id: string, patch: Partial<Highlight>) => void;
  } = $props();

  const preview = $derived(previewHighlightSettings(highlight.id));
  const eff = $derived(preview ? { ...highlight, ...preview } : highlight);
  const id = $derived(highlight.id);
</script>

<div class="space-y-2">
  <SliderField
    label="Dim amount"
    labelClassName="text-[9px]"
    value={eff.dimAmount}
    min={0}
    max={100}
    step={5}
    format={(v) => `${v}%`}
    onPreview={(v) => setPreviewHighlightSetting(id, { dimAmount: v })}
    onCommit={(v) => onUpdate(id, { dimAmount: v })}
  />
  <ToggleField
    label="Enlarge selection"
    labelClassName="text-[9px]"
    checked={eff.sizeUpEnabled}
    onChange={(v) => onUpdate(id, { sizeUpEnabled: v })}
  />
  {#if eff.sizeUpEnabled}
    <SliderField
      label="Enlarge amount"
      labelClassName="text-[9px]"
      value={eff.sizeUpAmount}
      min={105}
      max={250}
      step={5}
      format={(v) => `${v}%`}
      onPreview={(v) => setPreviewHighlightSetting(id, { sizeUpAmount: v })}
      onCommit={(v) => onUpdate(id, { sizeUpAmount: v })}
    />
  {/if}
  <ToggleField
    label="Custom timings"
    labelClassName="text-[9px]"
    checked={eff.useCustomTransition}
    onChange={(v) => onUpdate(id, { useCustomTransition: v })}
  />
  {#if eff.useCustomTransition}
    <SliderField
      label="Dim duration"
      labelClassName="text-[9px]"
      value={eff.dimTransition}
      min={100}
      max={2000}
      step={50}
      format={(v) => `${v}ms`}
      onPreview={(v) => setPreviewHighlightSetting(id, { dimTransition: v })}
      onCommit={(v) => onUpdate(id, { dimTransition: v })}
    />
    {#if eff.sizeUpEnabled}
      <SliderField
        label="Enlarge duration"
        labelClassName="text-[9px]"
        value={eff.sizeUpTransition}
        min={100}
        max={2000}
        step={50}
        format={(v) => `${v}ms`}
        onPreview={(v) => setPreviewHighlightSetting(id, { sizeUpTransition: v })}
        onCommit={(v) => onUpdate(id, { sizeUpTransition: v })}
      />
    {/if}
  {/if}
</div>
