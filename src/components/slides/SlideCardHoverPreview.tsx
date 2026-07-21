import { createPortal } from "react-dom";
import { CodeThumbnail } from "../ui/code-thumbnail";
import { Z_INDEX } from "../ui/overlay";

interface SlideCardHoverPreviewProps {
  show: boolean;
  html: string | null | undefined;
  containerRef: React.Ref<HTMLDivElement>;
  theme: string;
  left: number;
  top: number;
}

export function SlideCardHoverPreview({
  show,
  html,
  containerRef,
  theme,
  left,
  top,
}: SlideCardHoverPreviewProps) {
  if (!show || !html) return null;

  return createPortal(
    <CodeThumbnail
      containerRef={containerRef}
      html={html}
      theme={theme}
      fontSize={8}
      className="pointer-events-none fixed h-[170px] w-[300px] rounded-lg border border-border bg-card p-2 shadow-2xl"
      style={{ left, top, zIndex: Z_INDEX.hoverPreview }}
    />,
    document.body,
  );
}
