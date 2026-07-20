import { useUiStore } from "@/store/useUiStore";
import { useSlideMaps } from "./useSlideMaps";
import type { Project, Slide } from "@/types";

const EMPTY_SLIDES: Slide[] = [];

export function useCurrentSlide(project: Project | undefined) {
  const currentSlideId = useUiStore((s) => s.currentSlideId);
  const slides = project?.slides ?? EMPTY_SLIDES;
  const { slideMap, indexMap } = useSlideMaps(slides);
  const activeSlide =
    (currentSlideId ? slideMap.get(currentSlideId) : undefined) ?? slides[0];
  const activeIndex = activeSlide ? (indexMap.get(activeSlide.id) ?? -1) : -1;
  return { currentSlideId, activeSlide, activeIndex, slideMap, indexMap };
}
