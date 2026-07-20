import { cn } from "@/lib/utils";
import { themeBackground } from "@/types";

interface CodeThumbnailProps {
  html: string | null;
  fallback?: React.ReactNode;
  theme: string;
  fontSize?: number;
  lineHeight?: number;
  className?: string;
  codeClassName?: string;
  containerRef?: React.Ref<HTMLDivElement>;
  style?: React.CSSProperties;
}

export function CodeThumbnail({
  html,
  fallback = null,
  theme,
  fontSize = 5.5,
  lineHeight = 1.35,
  className,
  codeClassName,
  containerRef,
  style,
}: CodeThumbnailProps) {
  return (
    <div
      ref={containerRef}
      className={cn("relative w-full overflow-hidden", className)}
      style={{ backgroundColor: themeBackground(theme), ...style }}
      aria-hidden="true"
    >
      {html ? (
        <code
          className={cn(
            "pointer-events-none block overflow-hidden font-mono",
            codeClassName,
          )}
          style={{ fontSize: `${fontSize}px`, lineHeight, whiteSpace: "pre" }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        fallback
      )}
    </div>
  );
}
