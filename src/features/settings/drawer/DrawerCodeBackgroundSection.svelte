<script lang="ts">
  /** Code-background section of the settings drawer (§6.9). */
  import SettingsSection from "$lib/ui/SettingsSection.svelte";
  import TwoOptionPicker from "$lib/ui/TwoOptionPicker.svelte";
  import { setPreviewProjectSetting } from "$lib/stores/ui-state.svelte";
  import { themeBackground } from "$lib/types";

  let {
    checked,
    theme,
    onChange,
  }: {
    checked: boolean;
    theme: string;
    onChange: (useBlack: boolean) => void;
  } = $props();

  const options = $derived([
    { value: "theme", label: "Theme", swatch: themeBackground(theme) },
    { value: "black", label: "Black", swatch: "#000000" },
  ] as const);
</script>

<SettingsSection title="Code background">
  <TwoOptionPicker
    ariaLabel="Code background"
    value={checked ? "black" : "theme"}
    {options}
    onPreview={(value) =>
      setPreviewProjectSetting("useBlackCodeBackground", value === "black")}
    onPreviewEnd={() =>
      setPreviewProjectSetting("useBlackCodeBackground", null)}
    onCommit={(value) => {
      const useBlack = value === "black";
      setPreviewProjectSetting("useBlackCodeBackground", useBlack);
      onChange(useBlack);
    }}
  />
</SettingsSection>
