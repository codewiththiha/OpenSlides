interface UseCodeEditorScrollSyncArgs {
  textarea: () => HTMLTextAreaElement | null;
  pre: () => HTMLPreElement | null;
  gutter: () => HTMLElement | null;
  crud: { closeContextMenu: () => void };
}

export function createScrollSync(args: UseCodeEditorScrollSyncArgs) {
  function syncScroll() {
    args.crud.closeContextMenu();
    const el = args.textarea();
    if (!el) return;
    const top = el.scrollTop;
    const left = el.scrollLeft;
    const pre = args.pre();
    if (pre) {
      pre.scrollTop = top;
      pre.scrollLeft = left;
    }
    const gutter = args.gutter();
    if (gutter) {
      gutter.scrollTop = top;
    }
  }

  return syncScroll;
}
