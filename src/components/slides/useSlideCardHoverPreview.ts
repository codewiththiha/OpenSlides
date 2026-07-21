import { useEffect, useRef, useState, useCallback } from "react";

interface UseSlideCardHoverPreviewArgs {
  isOverlay: boolean;
  enableHoverPreview: boolean;
  cardRootRef: React.RefObject<HTMLDivElement | null>;
}

export function useSlideCardHoverPreview({
  isOverlay,
  enableHoverPreview,
  cardRootRef,
}: UseSlideCardHoverPreviewArgs) {
  const [showHoverPreview, setShowHoverPreview] = useState(false);
  const [hoverPosition, setHoverPosition] = useState({ left: 8, top: 8 });
  const hoverTimerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (hoverTimerRef.current !== null) window.clearTimeout(hoverTimerRef.current);
  }, []);

  const onMouseEnter = useCallback(() => {
    if (isOverlay || !enableHoverPreview) return;
    hoverTimerRef.current = window.setTimeout(() => {
      const rect = cardRootRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = 300;
      const height = 170;
      const left = Math.min(
        Math.max(8, rect.left),
        Math.max(8, window.innerWidth - width - 8),
      );
      const above = rect.top - height - 8;
      const top = above >= 8
        ? above
        : Math.min(rect.bottom + 8, window.innerHeight - height - 8);
      setHoverPosition({ left, top: Math.max(8, top) });
      setShowHoverPreview(true);
    }, 300);
  }, [isOverlay, enableHoverPreview, cardRootRef]);

  const onMouseLeave = useCallback(() => {
    if (hoverTimerRef.current !== null) window.clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = null;
    setShowHoverPreview(false);
  }, []);

  return { showHoverPreview, hoverPosition, onMouseEnter, onMouseLeave };
}
