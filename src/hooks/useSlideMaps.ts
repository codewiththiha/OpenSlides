import type { Slide } from "$lib/types";

/** Pure helper — consume through `$derived(slideMaps(slides))`. */
export function slideMaps(slides: Slide[]) {
  const slideMap = new Map<string, Slide>();
  const indexMap = new Map<string, number>();
  slides.forEach((slide, index) => {
    slideMap.set(slide.id, slide);
    indexMap.set(slide.id, index);
  });
  return { slideMap, indexMap };
}
