import { useMemo } from "react";
import type { Slide } from "@/types";

export function useSlideMaps(slides: Slide[]) {
  return useMemo(() => {
    const slideMap = new Map<string, Slide>();
    const indexMap = new Map<string, number>();
    slides.forEach((slide, index) => { slideMap.set(slide.id, slide); indexMap.set(slide.id, index); });
    return { slideMap, indexMap };
  }, [slides]);
}
