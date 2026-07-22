import { useMemo } from "react";
import type { Project, Slide } from "@/types";
import { usePreviewProjectSettings, usePreviewSlideSettings } from "./usePreviewSettings";

export function useEffectiveSettings(project: Project, slide?: Slide) {
  const previewProject = usePreviewProjectSettings();
  const settings = project.settings;
  const target = slide ?? project.slides[0];
  const previewSlide = usePreviewSlideSettings(target?.id);

  return useMemo(() => {
    const globalTransitionDuration = previewProject.globalTransitionDuration ?? settings.globalTransitionDuration;
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
      transitionDuration: settings.useGlobalTransition ? globalTransitionDuration : (previewSlide?.transitionDuration ?? target?.transitionDuration ?? globalTransitionDuration),
      stagger: settings.useGlobalStagger ? globalStagger : (previewSlide?.stagger ?? target?.stagger ?? globalStagger),
      duration: previewSlide?.duration ?? target?.duration ?? 3000,
    };
  }, [previewProject, previewSlide, settings, target]);
}
