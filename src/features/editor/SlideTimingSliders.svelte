<script lang="ts">
  import { untrack } from "svelte";
  import { ui, setPreviewProjectSetting, setPreviewSlideSetting } from "$lib/stores/ui-state.svelte";
  import { useUpdateSettings, useUpdateSlideSettings } from "$lib/queries";
  import SliderField from "$lib/ui/SliderField.svelte";
  import type { Project, Slide } from "$lib/types";

  let { project, slide }: { project: Project; slide: Slide } = $props();

  // Stable per mount — untrack() marks the one-time id capture.
  const projectId = untrack(() => project.id);
  const settingsMutation = useUpdateSlideSettings(projectId);
  const projectSettingsMutation = useUpdateSettings(projectId);

  const previewProject = $derived(ui.previewProject);
  const previewSlide = $derived(ui.previewSlides.get(slide.id));
  const useGlobalTransition = $derived(project.settings.useGlobalTransition);
  const useGlobalStagger = $derived(project.settings.useGlobalStagger);
  const transition = $derived(
    useGlobalTransition
      ? (previewProject.globalTransitionDuration ?? project.settings.globalTransitionDuration)
      : (previewSlide?.transitionDuration ?? slide.transitionDuration),
  );
  const stagger = $derived(
    useGlobalStagger
      ? (previewProject.globalStagger ?? project.settings.globalStagger)
      : (previewSlide?.stagger ?? slide.stagger),
  );
  const duration = $derived(previewSlide?.duration ?? slide.duration);
</script>

<div class="grid shrink-0 grid-cols-3 gap-2 border-t px-2 py-2">
  <SliderField
    label="Transition"
    labelClassName="uppercase tracking-wide"
    value={transition}
    min={100}
    max={2000}
    step={50}
    format={(v) => (useGlobalTransition ? `${v}ms · global` : `${v}ms`)}
    disabled={useGlobalTransition}
    onPreview={(v) =>
      useGlobalTransition
        ? setPreviewProjectSetting("globalTransitionDuration", v)
        : setPreviewSlideSetting(slide.id, "transitionDuration", v)}
    onCommit={(v) => {
      if (useGlobalTransition) projectSettingsMutation.mutate({ globalTransitionDuration: v });
      else settingsMutation.mutate({ slideId: slide.id, payload: { transitionDuration: v } });
    }}
  />
  <SliderField
    label="Stagger"
    labelClassName="uppercase tracking-wide"
    value={stagger}
    min={0}
    max={50}
    step={1}
    format={(v) => (useGlobalStagger ? `${v} · global` : `${v}`)}
    disabled={useGlobalStagger}
    onPreview={(v) =>
      useGlobalStagger
        ? setPreviewProjectSetting("globalStagger", v)
        : setPreviewSlideSetting(slide.id, "stagger", v)}
    onCommit={(v) => {
      if (useGlobalStagger) projectSettingsMutation.mutate({ globalStagger: v });
      else settingsMutation.mutate({ slideId: slide.id, payload: { stagger: v } });
    }}
  />
  <SliderField
    label="Duration"
    labelClassName="uppercase tracking-wide"
    value={duration}
    min={500}
    max={10000}
    step={100}
    format={(v) => `${v}ms`}
    onPreview={(v) => setPreviewSlideSetting(slide.id, "duration", v)}
    onCommit={(v) => settingsMutation.mutate({ slideId: slide.id, payload: { duration: v } })}
  />
</div>
