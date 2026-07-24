import type { Project, Slide } from "$lib/types";
import {
  previewProjectSettings,
  previewSlideSettings,
} from "./preview-settings";

export function createEffectiveSettings(
  project: () => Project,
  slide?: () => Slide | undefined,
) {
  const settings = $derived(project().settings);
  const target = $derived(slide?.() ?? project().slides[0]);
  const previewProject = $derived(previewProjectSettings());
  const previewSlide = $derived(previewSlideSettings(target?.id));

  const result = $derived.by(() => {
    const globalTransitionDuration =
      previewProject.globalTransitionDuration ??
      settings.globalTransitionDuration;
    const globalStagger =
      previewProject.globalStagger ?? settings.globalStagger;
    const globalDimAmount =
      previewProject.globalDimAmount ?? settings.globalDimAmount;
    const globalSizeUpAmount =
      previewProject.globalSizeUpAmount ?? settings.globalSizeUpAmount;
    const highlightDimColor =
      previewProject.highlightDimColor ?? settings.highlightDimColor;
    return {
      fontSize: previewProject.fontSize ?? settings.fontSize,
      lineHeight: previewProject.lineHeight ?? settings.lineHeight,
      editorFontSize: previewProject.editorFontSize ?? settings.editorFontSize,
      showLineNumbers: settings.showLineNumbers,
      useGlobalTransition: settings.useGlobalTransition,
      useGlobalStagger: settings.useGlobalStagger,
      useGlobalHighlight: settings.useGlobalHighlight,
      globalTransitionDuration,
      globalStagger,
      globalDimAmount,
      globalSizeUpAmount,
      highlightDimColor,
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
