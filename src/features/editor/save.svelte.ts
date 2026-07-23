/**
 * Debounced slide-code save (500ms) with explicit flush points.
 *
 * The pending edit is flushed when the slide switches or the editor
 * unmounts (the cleanup below) — a disposed timer must never discard the
 * final edit. Callers additionally flush before navigation.
 */
import { setSaveStatus } from "$lib/stores/ui-state.svelte";
import { updateSlideCodeMutation } from "$lib/queries";
import { clearPendingSave } from "$lib/lib/code-save";

export function createCodeSave(args: { slideId: () => string | undefined }) {
  const SAVE_DEBOUNCE_MS = 500;
  const codeMutation = updateSlideCodeMutation();

  let saveTimer: number | undefined;
  let pendingSave: { id: string; value: string } | null = null;

  function runSave(id: string, value: string) {
    setSaveStatus("saving");
    codeMutation.mutate(
      { slideId: id, code: value },
      {
        onSuccess: () => {
          setSaveStatus("saved");
          clearPendingSave(id, value);
        },
        onError: () => setSaveStatus("error"),
      },
    );
  }

  function schedule(id: string, value: string) {
    pendingSave = { id, value };
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      const p = pendingSave;
      pendingSave = null;
      saveTimer = undefined;
      if (p) runSave(p.id, p.value);
    }, SAVE_DEBOUNCE_MS);
  }

  /** Run the pending edit immediately, if any. */
  function flush() {
    if (saveTimer !== undefined && pendingSave) {
      window.clearTimeout(saveTimer);
      saveTimer = undefined;
      const { id, value } = pendingSave;
      pendingSave = null;
      runSave(id, value);
    }
  }

  $effect(() => {
    // A slide switch or editor unmount must persist the final debounced edit
    // before disposing its timer. This cleanup runs for both cases.
    void args.slideId();
    return () => {
      flush();
    };
  });

  return { schedule, flush };
}
