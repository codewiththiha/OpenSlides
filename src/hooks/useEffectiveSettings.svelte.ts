import { ui } from "@/store/ui-state.svelte";
import type { Project, Slide } from "@/types";

export function useEffectiveSettings(
  project: () => Project,
  slide?: () => Slide | undefined,
) {
  const settings = $derived(project().settings);
  const target = $derived(slide?.() ?? project().slides[0]);
  const previewProject = $derived(ui.previewProject);
  const previewSlide = $derived(target ? ui.previewSlides.get(target.id) : undefined);

  const result = $derived.by(() => {
    const globalTransitionDuration =
      previewProject.globalTransitionDuration ?? settings.globalTransitionDuration;
    const globalStagger = previewProject.globalStagger ?? settings.globalStagger;
    return {
      fontSize: previewProject.fontSize ?? settings.fontSize,
      lineHeight: previewProject.lineHeight ?? settings.lineHeight,
      editorFontSize: previewProject.editorFontSize ?? settings.editorFontSize,
      showLineNumbers: settings.showLineNumbers,
      useGlobalTransition: settings.useGlobalTransition,
      useGlobalStagger: settings.useGlobalStagger,
      globalTransitionDuration,
      globalStagger,
      transitionDuration: settings.useGlobalTransition
        ? globalTransitionDuration
        : (previewSlide?.transitionDuration ??
          target?.transitionDuration ??
          globalTransitionDuration),
      stagger: settings.useGlobalStagger
        ? globalStagger
        : (previewSlide?.stagger ?? target?.stagger ?? globalStagger),
      duration: previewSlide?.duration ?? target?.duration ?? 3000,
    };
  });

  return {
    get settings() {
      return result;
    },
  };
}
