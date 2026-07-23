<script lang="ts">
  /** Code-background section of the settings drawer (§6.9). */
  import SettingsSection from "$lib/ui/SettingsSection.svelte";
  import ToggleField from "$lib/ui/ToggleField.svelte";
  import { setPreviewProjectSetting } from "$lib/stores/ui-state.svelte";

  let {
    checked,
    onChange,
  }: {
    checked: boolean;
    onChange: (useBlack: boolean) => void;
  } = $props();
</script>

<SettingsSection title="Code background">
  <ToggleField
    label="Pure black background"
    description="Replace the syntax theme background with black for easy video compositing"
    {checked}
    onChange={(v) => {
      setPreviewProjectSetting("useBlackCodeBackground", v);
      onChange(v);
    }}
  />
</SettingsSection>
