import { nextStarterSlideAction } from "@/constants";
import { setCurrentSlideId } from "@/store/ui-state.svelte";
import { useCreateSlide, useUpdateSlideSettings } from "@/queries";
import type { Project } from "@/types";

/**
 * Canonical "Add Slide" use-case.
 *
 * Keep starter-deck sequencing, starter highlights, pending state, and
 * active-slide selection here so every entry point (slide rail, native menu,
 * command palette, etc.) behaves identically.
 */
export function useAddSlide(projectId: string, project: () => Project | undefined) {
  const createSlide = useCreateSlide(projectId);
  const updateSettings = useUpdateSlideSettings(projectId);
  let inFlight = $state(false);

  async function addSlide() {
    const current = project();
    if (!projectId || !current || inFlight) return;
    inFlight = true;

    try {
      const ordered = current.slides;
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
    } finally {
      inFlight = false;
    }
  }

  return {
    addSlide,
    get isPending() {
      return createSlide.isPending || updateSettings.isPending || inFlight;
    },
  };
}
