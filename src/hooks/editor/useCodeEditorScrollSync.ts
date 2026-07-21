interface UseCodeEditorScrollSyncArgs {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  preRef: React.RefObject<HTMLPreElement | null>;
  gutterRef: React.RefObject<HTMLDivElement | null>;
  crud: { closeContextMenu: () => void };
}

export function useCodeEditorScrollSync({
  textareaRef,
  preRef,
  gutterRef,
  crud,
}: UseCodeEditorScrollSyncArgs) {
  const syncScroll = () => {
    crud.closeContextMenu();
    if (!textareaRef.current) return;
    const top = textareaRef.current.scrollTop;
    const left = textareaRef.current.scrollLeft;
    if (preRef.current) {
      preRef.current.scrollTop = top;
      preRef.current.scrollLeft = left;
    }
    if (gutterRef.current) {
      gutterRef.current.scrollTop = top;
    }
  };

  return syncScroll;
}
