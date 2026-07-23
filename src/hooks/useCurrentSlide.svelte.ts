import { ui } from "$lib/stores/ui-state.svelte";
import { slideMaps } from "./useSlideMaps";
import type { Project, Slide } from "$lib/types";

const EMPTY_SLIDES: Slide[] = [];

export function useCurrentSlide(project: () => Project | undefined) {
  const slides = $derived(project()?.slides ?? EMPTY_SLIDES);
  const maps = $derived(slideMaps(slides));
  const activeSlide = $derived(
    (ui.currentSlideId ? maps.slideMap.get(ui.currentSlideId) : undefined) ??
      slides[0],
  );
  const activeIndex = $derived(
    activeSlide ? (maps.indexMap.get(activeSlide.id) ?? -1) : -1,
  );

  return {
    get currentSlideId() {
      return ui.currentSlideId;
    },
    get slides() {
      return slides;
    },
    get activeSlide() {
      return activeSlide;
    },
    get activeIndex() {
      return activeIndex;
    },
    get slideMap() {
      return maps.slideMap;
    },
    get indexMap() {
      return maps.indexMap;
    },
  };
}
