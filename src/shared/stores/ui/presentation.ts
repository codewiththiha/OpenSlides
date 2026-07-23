/** Presentation/current-slide slice (§6.4). */
import { ui } from "./ui-object.svelte";

export function setCurrentSlideId(id: string | null) {
  ui.currentSlideId = id;
}
export function setIsPresenting(v: boolean) {
  ui.isPresenting = v;
}
export function setIsAutoPlaying(v: boolean) {
  ui.isAutoPlaying = v;
}
export function toggleAutoPlaying() {
  ui.isAutoPlaying = !ui.isAutoPlaying;
}
