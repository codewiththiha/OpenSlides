/** Inline rename state machine (slide names, project names). */
export function createRenameState(
  onCommit: (id: string, name: string) => void | Promise<void>,
) {
  let renamingId = $state<string | null>(null);
  let value = $state("");

  function start(id: string, current: string) {
    renamingId = id;
    value = current;
  }

  function cancel() {
    renamingId = null;
  }

  async function commit() {
    const id = renamingId;
    if (!id) return;
    try {
      await onCommit(id, value.trim());
      renamingId = null;
    } catch {
      /* keep editing on failure */
    }
  }

  return {
    get renamingId() {
      return renamingId;
    },
    get value() {
      return value;
    },
    set value(v: string) {
      value = v;
    },
    start,
    cancel,
    commit,
  };
}
