import { useCallback } from "react";
import { slideDisplayName } from "@/types";
import type { Slide } from "@/types";
import { notify } from "@/lib/toast";
import type { UseMutationResult } from "@tanstack/react-query";
import type { Project } from "@/types";

interface SlidePanelMutations {
  deleteSlide: UseMutationResult<Project, Error, string>;
  restoreSlide: UseMutationResult<Project, Error, { slide: Slide; insertAt?: number }>;
  duplicateSlide: UseMutationResult<Project, Error, string>;
}

interface UseSlidePanelActionsArgs {
  ordered: Slide[];
  renamingId: string | null;
  mutations: SlidePanelMutations;
  currentSlideId: string | null;
  setCurrentSlideId: (id: string | null) => void;
  pendingFocusId: React.MutableRefObject<string | null>;
}

export function useSlidePanelActions({
  ordered,
  renamingId,
  mutations: { deleteSlide, restoreSlide, duplicateSlide },
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

  return { handleRemove, handleDuplicate };
}
