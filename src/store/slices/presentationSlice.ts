import type { StateCreator } from "zustand";
import type { UiState } from "../types";

export interface PresentationSlice {
  currentSlideId: string | null;
  isPresenting: boolean;
  isAutoPlaying: boolean;
  setCurrentSlideId: (id: string | null) => void;
  setIsPresenting: (v: boolean) => void;
  setIsAutoPlaying: (v: boolean) => void;
  toggleAutoPlaying: () => void;
}

export const createPresentationSlice: StateCreator<UiState, [], [], PresentationSlice> = (set) => ({
  currentSlideId: null,
  isPresenting: false,
  isAutoPlaying: false,

  setCurrentSlideId: (id) => set({ currentSlideId: id }),
  setIsPresenting: (v) => set({ isPresenting: v }),
  setIsAutoPlaying: (v) => set({ isAutoPlaying: v }),
  toggleAutoPlaying: () => set((s) => ({ isAutoPlaying: !s.isAutoPlaying })),
});
