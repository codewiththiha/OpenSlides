import { cn } from "@/lib/utils";

interface PreviewStageProps {
  containerRef: React.Ref<HTMLDivElement>;
  bg: string;
  stagePad: string;
  centerBlock: boolean;
  children: React.ReactNode;
}

export function PreviewStage({
  containerRef,
  bg,
  stagePad,
  centerBlock,
  children,
}: PreviewStageProps) {
  return (
    <div
      ref={containerRef}
      className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-xl shadow-2xl transition-colors duration-500"
      style={{ backgroundColor: bg }}
    >
      <div
        className={cn(
          "relative z-10 flex h-full w-full",
          stagePad,
          centerBlock ? "items-center justify-center" : "items-center justify-start",
        )}
      >
        <style
          dangerouslySetInnerHTML={{
            __html: `
          .shiki-magic-move-container,
          .shiki-magic-move-container pre,
          .shiki-magic-move-container code {
            background-color: transparent !important;
            white-space: pre !important;
            display: block !important;
            line-height: var(--line-height) !important;
            font-size: var(--font-size) !important;
            text-align: left !important;
          }
        `,
          }}
        />
        {children}
      </div>
    </div>
  );
}
