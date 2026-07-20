import { useMemo } from "react";
import { useUiStore } from "@/store/useUiStore";
import type { Project, Slide } from "@/types";
import { usePreviewSlidesMap } from "./usePreviewSettings";

export function useEffectiveSettings(project: Project, slide?: Slide) {
  const previewProject = useUiStore((s) => s.previewProject);
  const previewSlides = usePreviewSlidesMap();
  const settings = project.settings;
  const target = slide ?? project.slides[0];
  return useMemo(() => {
    const previewSlide = target ? previewSlides.get(target.id) : undefined;
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
  }, [previewProject, previewSlides, settings, target]);
}
