import { Label } from "../ui/label";
import { DebouncedSlider } from "../ui/debounced-slider";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/store/useUiStore";
import { usePreviewSlidesMap } from "@/hooks/usePreviewSettings";
import { useUpdateSettings, useUpdateSlideSettings } from "@/hooks/queries";
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
  const transitionLabel = useGlobalTransition ? `Transition (${transition}ms · global)` : `Transition (${transition}ms)`;
  const staggerLabel = useGlobalStagger ? `Stagger (${stagger} · global)` : `Stagger (${stagger})`;
  const durationLabel = `Duration (${duration}ms)`;

  return (
    <div className="grid shrink-0 grid-cols-3 gap-2 border-t px-2 py-2">
      <div className={cn("min-w-0 space-y-1", useGlobalTransition && "opacity-45")}>
        <Label className="block truncate text-[10px] uppercase tracking-wide text-muted-foreground" title={transitionLabel}>{transitionLabel}</Label>
        <DebouncedSlider min={100} max={2000} step={50} disabled={useGlobalTransition} value={[transition]} onValueChange={([v]) => useGlobalTransition ? setPreviewProjectSetting("globalTransitionDuration", v) : setPreviewSlideSetting(slide.id, "transitionDuration", v)} onValueCommit={([v]) => {
          if (useGlobalTransition) projectSettingsMutation.mutate({ globalTransitionDuration: v }, { onSuccess: () => clearPreviewProjectSetting("globalTransitionDuration") });
          else settingsMutation.mutate({ slideId: slide.id, payload: { transitionDuration: v } }, { onSuccess: () => clearPreviewSlideSetting(slide.id, "transitionDuration") });
        }} />
      </div>
      <div className={cn("min-w-0 space-y-1", useGlobalStagger && "opacity-45")}>
        <Label className="block truncate text-[10px] uppercase tracking-wide text-muted-foreground" title={staggerLabel}>{staggerLabel}</Label>
        <DebouncedSlider min={0} max={50} step={1} disabled={useGlobalStagger} value={[stagger]} onValueChange={([v]) => useGlobalStagger ? setPreviewProjectSetting("globalStagger", v) : setPreviewSlideSetting(slide.id, "stagger", v)} onValueCommit={([v]) => {
          if (useGlobalStagger) projectSettingsMutation.mutate({ globalStagger: v }, { onSuccess: () => clearPreviewProjectSetting("globalStagger") });
          else settingsMutation.mutate({ slideId: slide.id, payload: { stagger: v } }, { onSuccess: () => clearPreviewSlideSetting(slide.id, "stagger") });
        }} />
      </div>
      <div className="min-w-0 space-y-1">
        <Label className="block truncate text-[10px] uppercase tracking-wide text-muted-foreground" title={durationLabel}>{durationLabel}</Label>
        <DebouncedSlider min={500} max={10000} step={100} value={[duration]} onValueChange={([v]) => setPreviewSlideSetting(slide.id, "duration", v)} onValueCommit={([v]) => settingsMutation.mutate({ slideId: slide.id, payload: { duration: v } }, { onSuccess: () => clearPreviewSlideSetting(slide.id, "duration") })} />
      </div>
    </div>
  );
}
