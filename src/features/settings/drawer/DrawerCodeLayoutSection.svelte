<script lang="ts">
  /** Code alignment section of the settings drawer (§6.9). */
  import SettingsSection from "$lib/ui/SettingsSection.svelte";
  import CodeAlignPicker from "@/features/settings/CodeAlignPicker.svelte";

  let {
    value,
    onChange,
  }: {
    value: string;
    onChange: (align: "left" | "center") => void;
  } = $props();
</script>

<SettingsSection title="Code layout">
  <CodeAlignPicker {value} {onChange} />
</SettingsSection>
