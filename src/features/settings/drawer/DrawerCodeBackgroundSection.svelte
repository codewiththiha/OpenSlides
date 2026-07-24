<script lang="ts">
  /** Code-background section of the settings drawer (§6.9). */
  import { Check } from "@lucide/svelte";
  import SettingsSection from "$lib/ui/SettingsSection.svelte";
  import { setPreviewProjectSetting } from "$lib/stores/ui-state.svelte";
  import { cn } from "$lib/lib/utils";
  import { fallbackForeground, themeBackground } from "$lib/types";

  let {
    checked,
    theme,
    onChange,
    onReset,
  }: {
    checked: boolean;
    theme: string;
    onChange: (useBlack: boolean) => void;
    onReset: () => void;
  } = $props();

  const themeBg = $derived(themeBackground(theme));
  const themeFg = $derived(fallbackForeground(theme));

  const OPTIONS = [
    {
      value: false,
      label: "Theme",
      description: "Use syntax background",
    },
    {
      value: true,
      label: "Black",
      description: "Pure video matte",
    },
  ] as const;
</script>

<SettingsSection
  title="Code background"
  description="Choose the stage fill behind rendered code."
  {onReset}
>
  <div
    class="grid grid-cols-2 gap-3"
    role="radiogroup"
    aria-label="Code background"
  >
    {#each OPTIONS as option (option.label)}
      {@const selected = checked === option.value}
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        class={cn(
          "group rounded-xl border border-border/60 bg-background/40 p-2 text-center transition-all hover:border-primary/50 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-card focus-visible:outline-none",
          selected && "border-primary bg-primary/5",
        )}
        onclick={() => {
          setPreviewProjectSetting("useBlackCodeBackground", option.value);
          onChange(option.value);
        }}
      >
        <span
          class={cn(
            "relative mx-auto flex h-12 w-12 items-center justify-center rounded-lg border shadow-inner transition-transform group-hover:scale-105",
            selected
              ? "ring-2 ring-primary ring-offset-2 ring-offset-card"
              : "ring-0",
            option.value
              ? "border-white/10 bg-black"
              : "border-black/10 bg-[var(--swatch-bg)]",
          )}
          style="--swatch-bg: {themeBg}; color: {option.value
            ? '#fff'
            : themeFg};"
          aria-hidden="true"
        >
          {#if selected}
            <Check class="h-4 w-4" />
          {/if}
        </span>
        <span class="mt-2 block text-[10px] font-semibold text-foreground">
          {option.label}
        </span>
        <span
          class="mt-0.5 block text-[10px] leading-tight text-muted-foreground/70"
        >
          {option.description}
        </span>
      </button>
    {/each}
  </div>
</SettingsSection>
