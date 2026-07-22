import { useCallback } from "react";
import { slideDisplayName } from "@/types";
import type { Slide } from "@/types";
import { notify } from "@/lib/toast";
import type { SlideSettingsPatch } from "@/lib/tauri-api";
import type { UseMutationResult } from "@tanstack/react-query";
import type { Project } from "@/types";
import { nextStarterSlideAction } from "@/constants";

interface SlidePanelMutations {
  deleteSlide: UseMutationResult<Project, Error, string>;
  restoreSlide: UseMutationResult<Project, Error, { slide: Slide; insertAt?: number }>;
  duplicateSlide: UseMutationResult<Project, Error, string>;
  createSlide: UseMutationResult<Slide, Error, { code?: string; name?: string } | undefined>;
  updateSettings: UseMutationResult<Slide, Error, { slideId: string; payload: SlideSettingsPatch }>;
}

interface UseSlidePanelActionsArgs {
  ordered: Slide[];
  renamingId: string | null;
  mutations: SlidePanelMutations;
  currentSlideId: string | null;
  setCurrentSlideId: (id: string | null) => void;
  pendingFocusId: React.MutableRefObject<string | null>;
}

interface UseAddSlideActionArgs {
  ordered: Slide[];
  createSlide: SlidePanelMutations["createSlide"];
  updateSettings: SlidePanelMutations["updateSettings"];
  setCurrentSlideId: (id: string | null) => void;
}

/** One shared add flow for the slide rail, command palette, and native menu. */
export function useAddSlideAction({
  ordered,
  createSlide,
  updateSettings,
  setCurrentSlideId,
}: UseAddSlideActionArgs) {
  return useCallback(() => {
    const starterAction = nextStarterSlideAction(ordered);

    if (starterAction?.kind === "append") {
      void (async () => {
        const slide = await createSlide.mutateAsync({
          name: starterAction.slide.name,
          code: starterAction.slide.code,
        });
        if (starterAction.slide.highlights.length) {
          await updateSettings.mutateAsync({
            slideId: slide.id,
            payload: { highlights: starterAction.slide.highlights },
          });
        }
        setCurrentSlideId(slide.id);
      })().catch((err: Error) => notify.error(`Could not add starter slide: ${err.message}`));
      return;
    }

    const nextNum = ordered.length + 1;
    createSlide.mutate(
      { name: `Slide ${nextNum}` },
      {
        onSuccess: (slide) => setCurrentSlideId(slide.id),
      },
    );
  }, [ordered, createSlide, updateSettings, setCurrentSlideId]);
}

export function useSlidePanelActions({
  ordered,
  renamingId,
  mutations: { deleteSlide, restoreSlide, duplicateSlide, createSlide, updateSettings },
  currentSlideId,
  setCurrentSlideId,
  pendingFocusId,
}: UseSlidePanelActionsArgs) {
  const handleRemove = useCallback(
    (id: string) => {
      if (ordered.length <= 1 || renamingId) return;
      const index = ordered.findIndex((s) => s.id === id);
      const snapshot = ordered[index];
      if (!snapshot) return;
      pendingFocusId.current = ordered[index + 1]?.id ?? ordered[index - 1]?.id ?? null;

      deleteSlide.mutate(id, {
        onSuccess: (proj) => {
          if (currentSlideId === id) {
            const fallback =
              proj.settings.currentSlideId ?? proj.slides[0]?.id ?? null;
            setCurrentSlideId(fallback);
          }
          notify.message("Slide deleted", {
            description: slideDisplayName(snapshot, index),
            action: {
              label: "Undo",
              onClick: () => {
                restoreSlide.mutate({
                  slide: snapshot,
                  insertAt: index,
                });
              },
            },
          });
        },
      });
    },
    [ordered, renamingId, deleteSlide, restoreSlide, currentSlideId, setCurrentSlideId, pendingFocusId],
  );

  const handleDuplicate = useCallback(
    (id: string) => {
      duplicateSlide.mutate(id);
    },
    [duplicateSlide],
  );

  const handleAdd = useAddSlideAction({ ordered, createSlide, updateSettings, setCurrentSlideId });

  return { handleRemove, handleDuplicate, handleAdd };
}
