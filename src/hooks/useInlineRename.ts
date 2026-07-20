import { useCallback, useRef, useState } from "react";

export function useInlineRename(onCommit: (id: string, name: string) => void | Promise<void>) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const idRef = useRef<string | null>(null);
  const valueRef = useRef("");
  idRef.current = renamingId;
  valueRef.current = value;
  const start = useCallback((id: string, current: string) => { setRenamingId(id); setValue(current); }, []);
  const cancel = useCallback(() => setRenamingId(null), []);
  const commit = useCallback(async () => {
    const id = idRef.current;
    if (!id) return;
    try { await onCommit(id, valueRef.current.trim()); setRenamingId(null); } catch {}
  }, [onCommit]);
  return { renamingId, value, setValue, start, cancel, commit };
}
