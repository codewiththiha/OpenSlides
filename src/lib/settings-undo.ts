/** Session-only undo toasts for committed settings changes. */
import { notify } from "./toast";

const activeUndoToasts = new Set<string | number>();

export function showUndoToast(id: string, message: string, onUndo: () => void) {
  activeUndoToasts.add(id);
  notify.message(message, {
    id,
    duration: 5000,
    action: {
      label: "Undo",
      onClick: () => {
        activeUndoToasts.delete(id);
        onUndo();
      },
    },
  });
}

export function dismissAllUndoToasts() {
  activeUndoToasts.forEach((id) => notify.dismiss(id));
  activeUndoToasts.clear();
}
