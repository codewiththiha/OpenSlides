import { useUiStore } from "@/store/useUiStore";
import { usePreviewProjectSettings, usePreviewSlideSettings } from "@/hooks/usePreviewSettings";
import { useUpdateSettings, useUpdateSlideSettings } from "@/hooks/queries";
import { SliderField } from "../ui/slider-field";
import type { Project, Slide } from "@/types";

export function SlideTimingSliders({ project, slide }: { project: Project; slide: Slide }) {
  const settingsMutation = useUpdateSlideSettings(project.id);
  const projectSettingsMutation = useUpdateSettings(project.id);
  const previewProject = usePreviewProjectSettings();
  const previewSlide = usePreviewSlideSettings(slide.id);
  const setPreviewProjectSetting = useUiStore((s) => s.setPreviewProjectSetting);
  const setPreviewSlideSetting = useUiStore((s) => s.setPreviewSlideSetting);
  const useGlobalTransition = project.settings.useGlobalTransition;
  const useGlobalStagger = project.settings.useGlobalStagger;
  const transition = useGlobalTransition ? (previewProject.globalTransitionDuration ?? project.settings.globalTransitionDuration) : (previewSlide?.transitionDuration ?? slide.transitionDuration);
  const stagger = useGlobalStagger ? (previewProject.globalStagger ?? project.settings.globalStagger) : (previewSlide?.stagger ?? slide.stagger);
  const duration = previewSlide?.duration ?? slide.duration;

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
          if (useGlobalTransition) projectSettingsMutation.mutate({ globalTransitionDuration: v });
          else settingsMutation.mutate({ slideId: slide.id, payload: { transitionDuration: v } });
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
          if (useGlobalStagger) projectSettingsMutation.mutate({ globalStagger: v });
          else settingsMutation.mutate({ slideId: slide.id, payload: { stagger: v } });
        }}
      />
      <SliderField
        label="Duration"
        labelClassName="uppercase tracking-wide"
        value={duration}
        min={500} max={10000} step={100}
        format={(v) => `${v}ms`}
        onPreview={(v) => setPreviewSlideSetting(slide.id, "duration", v)}
        onCommit={(v) => settingsMutation.mutate({ slideId: slide.id, payload: { duration: v } })}
      />
    </div>
  );
}
