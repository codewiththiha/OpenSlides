import { cn } from "@/lib/utils";
import { fallbackForeground } from "@/types";

interface PreviewFallbackProps {
  isMerustmarFail: boolean;
  theme: string;
  code: string;
  fontSize: number;
  lineHeight: number;
  stagePad: string;
  centerBlock: boolean;
  bg: string;
  containerRef: React.Ref<HTMLDivElement>;
}

export function PreviewFallback({
  isMerustmarFail,
  theme,
  code,
  fontSize,
  lineHeight,
  stagePad,
  centerBlock,
  bg,
  containerRef,
}: PreviewFallbackProps) {
  // A grammar load failure must not leave Merustmar stuck on a spinner.
  // Shiki remains the primary path; plain text is only the last-resort
  // display when the custom grammar cannot be loaded.
  if (isMerustmarFail) {
    return (
      <div ref={containerRef} className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-xl shadow-2xl" style={{ backgroundColor: bg }}>
        <div className={cn("relative z-10 flex h-full w-full", stagePad, centerBlock ? "items-center justify-center" : "items-center justify-start")}>
          <pre className="font-mono font-medium tracking-wide text-left" style={{ fontSize: `${fontSize}px`, lineHeight, color: fallbackForeground(theme), whiteSpace: "pre" }}>{code}</pre>
        </div>
      </div>
    );
  }

  return <div className="flex h-full w-full items-center justify-center text-muted-foreground">Loading preview…</div>;
}
