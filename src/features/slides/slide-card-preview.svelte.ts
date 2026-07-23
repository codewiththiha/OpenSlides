interface UseSlideCardHoverPreviewArgs {
  isOverlay: boolean;
  enableHoverPreview: () => boolean;
  cardRoot: () => HTMLDivElement | null;
}

export function createSlideCardHoverPreview(args: UseSlideCardHoverPreviewArgs) {
  let showHoverPreview = $state(false);
  let hoverPosition = $state({ left: 8, top: 8 });
  let hoverTimer: number | null = null;

  $effect(() => () => {
    if (hoverTimer !== null) window.clearTimeout(hoverTimer);
  });

  function onMouseEnter() {
    if (args.isOverlay || !args.enableHoverPreview()) return;
    hoverTimer = window.setTimeout(() => {
      const rect = args.cardRoot()?.getBoundingClientRect();
      if (!rect) return;
      const width = 300;
      const height = 170;
      const left = Math.min(
        Math.max(8, rect.left),
        Math.max(8, window.innerWidth - width - 8),
      );
      const above = rect.top - height - 8;
      const top =
        above >= 8
          ? above
          : Math.min(rect.bottom + 8, window.innerHeight - height - 8);
      hoverPosition = { left, top: Math.max(8, top) };
      showHoverPreview = true;
    }, 300);
  }

  function onMouseLeave() {
    if (hoverTimer !== null) window.clearTimeout(hoverTimer);
    hoverTimer = null;
    showHoverPreview = false;
  }

  return {
    get showHoverPreview() {
      return showHoverPreview;
    },
    get hoverPosition() {
      return hoverPosition;
    },
    onMouseEnter,
    onMouseLeave,
  };
}
