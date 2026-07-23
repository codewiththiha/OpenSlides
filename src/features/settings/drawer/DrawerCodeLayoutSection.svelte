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

<SettingsSection
  title="Code layout"
  description="Where the code block sits on your slides. Applies to all slides."
>
  <CodeAlignPicker {value} {onChange} />
</SettingsSection>
