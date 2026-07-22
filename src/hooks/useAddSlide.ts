import { useCallback } from "react";
import { nextStarterSlideAction } from "@/constants";
import { useUiStore } from "@/store/useUiStore";
import { useCreateSlide, useProject, useUpdateSlideSettings } from "@/hooks/queries";

/**
 * Canonical "Add Slide" use-case.
 *
 * Keep starter-deck sequencing, starter highlights, and active-slide selection
 * here so every entry point (slide rail, native menu, command palette, etc.)
 * behaves identically.
 */
export function useAddSlide(projectId: string) {
  const { data: project } = useProject(projectId);
  const createSlide = useCreateSlide(projectId);
  const updateSettings = useUpdateSlideSettings(projectId);
  const setCurrentSlideId = useUiStore((s) => s.setCurrentSlideId);

  return useCallback(async () => {
    if (!projectId || !project) return;

    try {
      const ordered = project.slides;
      const starterAction = nextStarterSlideAction(ordered);

      if (starterAction?.kind === "append") {
        const slide = await createSlide.mutateAsync({
          name: starterAction.slide.name,
          code: starterAction.slide.code,
        });

        try {
          if (starterAction.slide.highlights.length) {
            await updateSettings.mutateAsync({
              slideId: slide.id,
              payload: { highlights: starterAction.slide.highlights },
            });
          }
        } finally {
          setCurrentSlideId(slide.id);
        }
        return;
      }

      const slide = await createSlide.mutateAsync({
        name: `Slide ${ordered.length + 1}`,
      });
      setCurrentSlideId(slide.id);
    } catch {
      // Mutation hooks own user-facing error toasts. Swallow here so menu,
      // command-palette, and button handlers do not produce unhandled promises.
    }
  }, [projectId, project, createSlide, updateSettings, setCurrentSlideId]);
}
