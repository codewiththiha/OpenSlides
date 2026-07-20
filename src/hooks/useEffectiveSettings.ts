import { useMemo } from "react";
import { useUiStore } from "@/store/useUiStore";
import type { Project } from "@/types";
import { useSlideMaps } from "./useSlideMaps";

export function useEffectiveSettings(project: Project, slideId?: string) {
  const previewProject = useUiStore((s) => s.previewProject);
  const previewSlidesRevision = useUiStore((s) => s.previewSlidesRevision);
  const previewSlides = useUiStore.getState().previewSlides;
  const { slideMap } = useSlideMaps(project.slides);
  const settings = project.settings;
  const slide = slideId ? slideMap.get(slideId) : project.slides[0];
  return useMemo(() => {
    const previewSlide = slide ? previewSlides.get(slide.id) : undefined;
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
      transitionDuration: settings.useGlobalTransition ? globalTransitionDuration : (previewSlide?.transitionDuration ?? slide?.transitionDuration ?? globalTransitionDuration),
      stagger: settings.useGlobalStagger ? globalStagger : (previewSlide?.stagger ?? slide?.stagger ?? globalStagger),
      duration: previewSlide?.duration ?? slide?.duration ?? 3000,
    };
  }, [previewProject, previewSlidesRevision, previewSlides, settings, slide]);
}
