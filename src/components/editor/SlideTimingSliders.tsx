import { useUiStore } from "@/store/useUiStore";
import { usePreviewSlidesMap } from "@/hooks/usePreviewSettings";
import { useUpdateSettings, useUpdateSlideSettings } from "@/hooks/queries";
import { SliderField } from "../ui/slider-field";
import type { Project, Slide } from "@/types";

export function SlideTimingSliders({ project, slide }: { project: Project; slide: Slide }) {
  const settingsMutation = useUpdateSlideSettings(project.id);
  const projectSettingsMutation = useUpdateSettings(project.id);
  const previewProject = useUiStore((s) => s.previewProject);
  const previewSlides = usePreviewSlidesMap();
  const setPreviewProjectSetting = useUiStore((s) => s.setPreviewProjectSetting);
  const setPreviewSlideSetting = useUiStore((s) => s.setPreviewSlideSetting);
  const clearPreviewProjectSetting = useUiStore((s) => s.clearPreviewProjectSetting);
  const clearPreviewSlideSetting = useUiStore((s) => s.clearPreviewSlideSetting);
  const useGlobalTransition = project.settings.useGlobalTransition;
  const useGlobalStagger = project.settings.useGlobalStagger;
  const transition = useGlobalTransition ? (previewProject.globalTransitionDuration ?? project.settings.globalTransitionDuration) : (previewSlides.get(slide.id)?.transitionDuration ?? slide.transitionDuration);
  const stagger = useGlobalStagger ? (previewProject.globalStagger ?? project.settings.globalStagger) : (previewSlides.get(slide.id)?.stagger ?? slide.stagger);
  const duration = previewSlides.get(slide.id)?.duration ?? slide.duration;

  return (
    <div className="grid shrink-0 grid-cols-3 gap-2 border-t px-2 py-2">
      <SliderField
        label="Transition"
        labelClassName="uppercase tracking-wide"
        value={transition}
        min={100} max={2000} step={50}
        format={(v) => useGlobalTransition ? `${v}ms · global` : `${v}ms`}
        disabled={useGlobalTransition}
        onPreview={(v) => useGlobalTransition ? setPreviewProjectSetting("globalTransitionDuration", v) : setPreviewSlideSetting(slide.id, "transitionDuration", v)}
        onCommit={(v) => {
          if (useGlobalTransition) projectSettingsMutation.mutate({ globalTransitionDuration: v }, { onSuccess: () => clearPreviewProjectSetting("globalTransitionDuration") });
          else settingsMutation.mutate({ slideId: slide.id, payload: { transitionDuration: v } }, { onSuccess: () => clearPreviewSlideSetting(slide.id, "transitionDuration") });
        }}
      />
      <SliderField
        label="Stagger"
        labelClassName="uppercase tracking-wide"
        value={stagger}
        min={0} max={50} step={1}
        format={(v) => useGlobalStagger ? `${v} · global` : `${v}`}
        disabled={useGlobalStagger}
        onPreview={(v) => useGlobalStagger ? setPreviewProjectSetting("globalStagger", v) : setPreviewSlideSetting(slide.id, "stagger", v)}
        onCommit={(v) => {
          if (useGlobalStagger) projectSettingsMutation.mutate({ globalStagger: v }, { onSuccess: () => clearPreviewProjectSetting("globalStagger") });
          else settingsMutation.mutate({ slideId: slide.id, payload: { stagger: v } }, { onSuccess: () => clearPreviewSlideSetting(slide.id, "stagger") });
        }}
      />
      <SliderField
        label="Duration"
        labelClassName="uppercase tracking-wide"
        value={duration}
        min={500} max={10000} step={100}
        format={(v) => `${v}ms`}
        onPreview={(v) => setPreviewSlideSetting(slide.id, "duration", v)}
        onCommit={(v) => settingsMutation.mutate({ slideId: slide.id, payload: { duration: v } }, { onSuccess: () => clearPreviewSlideSetting(slide.id, "duration") })}
      />
    </div>
  );
}
