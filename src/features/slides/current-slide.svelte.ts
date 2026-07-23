import { ui } from "$lib/stores/ui-state.svelte";
import { slideMaps } from "$lib/lib/slides";
import type { Project, Slide } from "$lib/types";

const EMPTY_SLIDES: Slide[] = [];

export function createCurrentSlide(
  project: () => Project | undefined,
  slideId?: () => string | undefined,
) {
  // Explicit callers (§7.3) pass their own slide id; the editor defaults
  // to the rune store's currentSlideId.
  const id = $derived(slideId?.() ?? ui.currentSlideId);
  const slides = $derived(project()?.slides ?? EMPTY_SLIDES);
  const maps = $derived(slideMaps(slides));
  const activeSlide = $derived(
    (id ? maps.slideMap.get(id) : undefined) ?? slides[0],
  );
  const activeIndex = $derived(
    activeSlide ? (maps.indexMap.get(activeSlide.id) ?? -1) : -1,
  );

  return {
    get currentSlideId() {
      return id;
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
