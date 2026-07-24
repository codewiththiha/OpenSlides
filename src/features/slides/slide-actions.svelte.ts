import { slideDisplayName, type Project, type Slide } from "$lib/types";
import { notify } from "$lib/lib/toast";
import { api } from "$lib/lib/tauri-api";
import { ui, setCurrentSlideId } from "$lib/stores/ui-state.svelte";
import {
  deleteSlideMutation,
  duplicateSlideMutation,
  projectKeys,
  reorderSlidesMutation,
  restoreSlideMutation,
  stackSlidesMutation,
  unstackSlidesMutation,
} from "$lib/queries";
import { queryClient } from "$lib/queries/query-client";

interface DeleteSlideArgs {
  ordered: () => Slide[];
  renamingId?: () => string | null;
  pendingFocusId?: { current: string | null };
}

function cloneSlideSnapshot(slide: Slide): Slide {
  return JSON.parse(JSON.stringify(slide)) as Slide;
}

/** User action: delete one slide, select the backend fallback, and offer Undo. */
export function createSlideDeleter(
  projectId: string,
  { ordered, renamingId = () => null, pendingFocusId }: DeleteSlideArgs,
) {
  const deleteSlide = deleteSlideMutation(projectId);
  const restoreSlide = restoreSlideMutation(projectId);

  async function restoreSlidesWithUndo(
    snapshots: Array<{ slide: Slide; index: number }>,
  ) {
    try {
      let project: Project | null = null;
      for (const { slide, index } of [...snapshots].sort(
        (a, b) => a.index - b.index,
      )) {
        project = await api.restoreSlide(projectId, slide, index);
      }
      if (!project) return;
      queryClient.setQueryData(projectKeys.detail(projectId), project);
      await queryClient.invalidateQueries({
        queryKey: projectKeys.detail(projectId),
      });
      await queryClient.invalidateQueries({ queryKey: projectKeys.all });
      notify.success(
        `${snapshots.length} slide${snapshots.length === 1 ? "" : "s"} restored`,
      );
    } catch (error) {
      notify.error(`Restore failed: ${(error as Error).message}`);
    }
  }

  function deleteSlideWithUndo(id: string) {
    const list = ordered();
    const renaming = renamingId();
    if (list.length <= 1 || renaming) return;
    const index = list.findIndex((slide) => slide.id === id);
    const snapshot = list[index];
    if (!snapshot) return;
    const restoreSnapshot = cloneSlideSnapshot(snapshot);

    if (pendingFocusId) {
      pendingFocusId.current =
        list[index + 1]?.id ?? list[index - 1]?.id ?? null;
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
              restoreSlide.mutate({ slide: restoreSnapshot, insertAt: index });
            },
          },
        });
      },
    });
  }

  async function deleteSlides(ids: string[]) {
    const deletedIds = new Set<string>();
    const list = ordered();
    const renaming = renamingId();
    if (list.length <= 1 || renaming) return { ok: false as const, deletedIds };

    const indexMap = new Map(list.map((slide, index) => [slide.id, index]));
    const snapshots = [...new Set(ids)]
      .map((id) => {
        const index = indexMap.get(id);
        return index === undefined
          ? null
          : { slide: cloneSlideSnapshot(list[index]!), index };
      })
      .filter(
        (entry): entry is { slide: Slide; index: number } => entry !== null,
      );

    if (!snapshots.length || snapshots.length >= list.length) {
      return { ok: false as const, deletedIds };
    }

    const deletingCurrent = snapshots.some(
      ({ slide }) => slide.id === ui.currentSlideId,
    );

    try {
      let project: Project | null = null;
      for (const { slide } of snapshots) {
        project = await deleteSlide.mutateAsync(slide.id);
        deletedIds.add(slide.id);
      }
      if (deletingCurrent && project) {
        const fallback =
          project.settings.currentSlideId ?? project.slides[0]?.id ?? null;
        setCurrentSlideId(fallback);
      }
      notify.message(
        `${snapshots.length} slide${snapshots.length === 1 ? "" : "s"} deleted`,
        {
          description:
            snapshots.length === 1
              ? slideDisplayName(snapshots[0]!.slide, snapshots[0]!.index)
              : snapshots
                  .map(({ slide, index }) => slideDisplayName(slide, index))
                  .join(", "),
          action: {
            label: "Undo",
            onClick: () => {
              void restoreSlidesWithUndo(snapshots);
            },
          },
        },
      );
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

  function stackSlides(
    sourceIds: string[],
    targetId: string,
    opts?: { onSuccess?: () => void },
  ) {
    stackMutation.mutate(
      { sourceIds, targetId },
      { onSuccess: opts?.onSuccess },
    );
  }

  function unstackSlides(
    slideIds: string[],
    opts?: { onSuccess?: () => void },
  ) {
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
