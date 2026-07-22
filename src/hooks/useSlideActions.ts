import { useCallback } from "react";
import { slideDisplayName, type Slide } from "@/types";
import { notify } from "@/lib/toast";
import { useUiStore } from "@/store/useUiStore";
import {
  useDeleteSlide as useDeleteSlideMutation,
  useDuplicateSlide as useDuplicateSlideMutation,
  useReorderSlides as useReorderSlidesMutation,
  useRestoreSlide,
  useStackSlides as useStackSlidesMutation,
  useUnstackSlides as useUnstackSlidesMutation,
} from "@/hooks/queries";

interface DeleteSlideArgs {
  ordered: Slide[];
  renamingId?: string | null;
  pendingFocusId?: React.MutableRefObject<string | null>;
}

/** User action: delete one slide, select the backend fallback, and offer Undo. */
export function useDeleteSlideWithUndo(
  projectId: string,
  { ordered, renamingId = null, pendingFocusId }: DeleteSlideArgs,
) {
  const deleteSlide = useDeleteSlideMutation(projectId);
  const restoreSlide = useRestoreSlide(projectId);
  const currentSlideId = useUiStore((s) => s.currentSlideId);
  const setCurrentSlideId = useUiStore((s) => s.setCurrentSlideId);

  const deleteSlideWithUndo = useCallback(
    (id: string) => {
      if (ordered.length <= 1 || renamingId) return;
      const index = ordered.findIndex((slide) => slide.id === id);
      const snapshot = ordered[index];
      if (!snapshot) return;

      if (pendingFocusId) {
        pendingFocusId.current = ordered[index + 1]?.id ?? ordered[index - 1]?.id ?? null;
      }

      deleteSlide.mutate(id, {
        onSuccess: (project) => {
          if (currentSlideId === id) {
            const fallback = project.settings.currentSlideId ?? project.slides[0]?.id ?? null;
            setCurrentSlideId(fallback);
          }
          notify.message("Slide deleted", {
            description: slideDisplayName(snapshot, index),
            action: {
              label: "Undo",
              onClick: () => {
                restoreSlide.mutate({ slide: snapshot, insertAt: index });
              },
            },
          });
        },
      });
    },
    [ordered, renamingId, pendingFocusId, deleteSlide, restoreSlide, currentSlideId, setCurrentSlideId],
  );

  const deleteSlides = useCallback(
    async (ids: string[]) => {
      const deletedIds = new Set<string>();
      try {
        for (const id of ids) {
          await deleteSlide.mutateAsync(id);
          deletedIds.add(id);
        }
        return { ok: true as const, deletedIds };
      } catch (error) {
        // The underlying delete mutation already owns the user-facing error
        // toast. Keep the bulk action silent here to avoid duplicate errors.
        return { ok: false as const, deletedIds, error: error as Error };
      }
    },
    [deleteSlide],
  );

  return { deleteSlideWithUndo, deleteSlides, isPending: deleteSlide.isPending };
}

/** User action: duplicate a slide and let the mutation policy select the new slide. */
export function useDuplicateSlide(projectId: string) {
  const duplicateSlide = useDuplicateSlideMutation(projectId);
  return useCallback(
    (id: string) => {
      duplicateSlide.mutate(id);
    },
    [duplicateSlide],
  );
}

/** User action: commit a new slide order, with optional UI rollback for optimistic rails. */
export function useReorderSlides(projectId: string) {
  const reorderSlides = useReorderSlidesMutation(projectId);
  return useCallback(
    (slideIds: string[], opts?: { onError?: () => void }) => {
      reorderSlides.mutate(slideIds, {
        onError: opts?.onError,
      });
    },
    [reorderSlides],
  );
}

/** User action: create or dissolve slide stacks. */
export function useStackSlides(projectId: string) {
  const stackMutation = useStackSlidesMutation(projectId);
  const unstackMutation = useUnstackSlidesMutation(projectId);

  const stackSlides = useCallback(
    (sourceIds: string[], targetId: string, opts?: { onSuccess?: () => void }) => {
      stackMutation.mutate(
        { sourceIds, targetId },
        { onSuccess: opts?.onSuccess },
      );
    },
    [stackMutation],
  );

  const unstackSlides = useCallback(
    (slideIds: string[], opts?: { onSuccess?: () => void }) => {
      unstackMutation.mutate(slideIds, { onSuccess: opts?.onSuccess });
    },
    [unstackMutation],
  );

  return {
    stackSlides,
    unstackSlides,
    isStacking: stackMutation.isPending,
    isUnstacking: unstackMutation.isPending,
  };
}
