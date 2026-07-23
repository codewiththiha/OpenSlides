<script lang="ts">
  import { untrack } from "svelte";
  import { ui, setPreviewProjectSetting, setPreviewSlideSetting } from "$lib/stores/ui-state.svelte";
  import { updateProjectSettingsMutation, updateSlideSettingsMutation } from "$lib/queries";
  import SliderField from "$lib/ui/SliderField.svelte";
  import type { Project, Slide } from "$lib/types";

  let { project, slide }: { project: Project; slide: Slide } = $props();

  // Stable per mount — untrack() marks the one-time id capture.
  const projectId = untrack(() => project.id);
  const settingsMutation = updateSlideSettingsMutation(projectId);
  const projectSettingsMutation = updateProjectSettingsMutation(projectId);

  const previewProject = $derived(ui.previewProject);
  const previewSlide = $derived(ui.previewSlides.get(slide.id));
  const globalTransitionEnabled = $derived(project.settings.useGlobalTransition);
  const globalStaggerEnabled = $derived(project.settings.useGlobalStagger);
  const transition = $derived(
    globalTransitionEnabled
      ? (previewProject.globalTransitionDuration ?? project.settings.globalTransitionDuration)
      : (previewSlide?.transitionDuration ?? slide.transitionDuration),
  );
  const stagger = $derived(
    globalStaggerEnabled
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
    format={(v) => (globalTransitionEnabled ? `${v}ms · global` : `${v}ms`)}
    disabled={globalTransitionEnabled}
    onPreview={(v) =>
      globalTransitionEnabled
        ? setPreviewProjectSetting("globalTransitionDuration", v)
        : setPreviewSlideSetting(slide.id, "transitionDuration", v)}
    onCommit={(v) => {
      if (globalTransitionEnabled) projectSettingsMutation.mutate({ globalTransitionDuration: v });
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
    format={(v) => (globalStaggerEnabled ? `${v} · global` : `${v}`)}
    disabled={globalStaggerEnabled}
    onPreview={(v) =>
      globalStaggerEnabled
        ? setPreviewProjectSetting("globalStagger", v)
        : setPreviewSlideSetting(slide.id, "stagger", v)}
    onCommit={(v) => {
      if (globalStaggerEnabled) projectSettingsMutation.mutate({ globalStagger: v });
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
