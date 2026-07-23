import { slideDisplayName, type Slide } from "$lib/types";
import { notify } from "$lib/lib/toast";
import { ui, setCurrentSlideId } from "$lib/stores/ui-state.svelte";
import {
  deleteSlideMutation,
  duplicateSlideMutation,
  reorderSlidesMutation,
  restoreSlideMutation,
  stackSlidesMutation,
  unstackSlidesMutation,
} from "$lib/queries";

interface DeleteSlideArgs {
  ordered: () => Slide[];
  renamingId?: () => string | null;
  pendingFocusId?: { current: string | null };
}

/** User action: delete one slide, select the backend fallback, and offer Undo. */
export function createSlideDeleter(
  projectId: string,
  { ordered, renamingId = () => null, pendingFocusId }: DeleteSlideArgs,
) {
  const deleteSlide = deleteSlideMutation(projectId);
  const restoreSlide = restoreSlideMutation(projectId);

  function deleteSlideWithUndo(id: string) {
    const list = ordered();
    const renaming = renamingId();
    if (list.length <= 1 || renaming) return;
    const index = list.findIndex((slide) => slide.id === id);
    const snapshot = list[index];
    if (!snapshot) return;

    if (pendingFocusId) {
      pendingFocusId.current = list[index + 1]?.id ?? list[index - 1]?.id ?? null;
    }

    deleteSlide.mutate(id, {
      onSuccess: (project) => {
        if (ui.currentSlideId === id) {
          const fallback =
            project.settings.currentSlideId ?? project.slides[0]?.id ?? null;
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
  }

  async function deleteSlides(ids: string[]) {
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
  }

  return {
    deleteSlideWithUndo,
    deleteSlides,
    get isPending() {
      return deleteSlide.isPending;
    },
  };
}

/** User action: duplicate a slide and let the mutation policy select the new slide. */
export function createSlideDuplicator(projectId: string) {
  const duplicateSlide = duplicateSlideMutation(projectId);
  return (id: string) => {
    duplicateSlide.mutate(id);
  };
}

/** User action: commit a new slide order, with optional UI rollback for optimistic rails. */
export function createSlideReorderer(projectId: string) {
  const reorderSlides = reorderSlidesMutation(projectId);
  return (slideIds: string[], opts?: { onError?: () => void }) => {
    reorderSlides.mutate(slideIds, {
      onError: opts?.onError,
    });
  };
}

/** User action: create or dissolve slide stacks. */
export function createSlideStackActions(projectId: string) {
  const stackMutation = stackSlidesMutation(projectId);
  const unstackMutation = unstackSlidesMutation(projectId);

  function stackSlides(sourceIds: string[], targetId: string, opts?: { onSuccess?: () => void }) {
    stackMutation.mutate(
      { sourceIds, targetId },
      { onSuccess: opts?.onSuccess },
    );
  }

  function unstackSlides(slideIds: string[], opts?: { onSuccess?: () => void }) {
    unstackMutation.mutate(slideIds, { onSuccess: opts?.onSuccess });
  }

  return {
    stackSlides,
    unstackSlides,
    get isStacking() {
      return stackMutation.isPending;
    },
    get isUnstacking() {
      return unstackMutation.isPending;
    },
  };
}
