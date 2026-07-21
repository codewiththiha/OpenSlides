import { memo } from "react";
import { ShikiMagicMove } from "shiki-magic-move/react";
import type { Highlighter } from "shiki";
import { cn } from "@/lib/utils";

export const MagicMoveBlock = memo(function MagicMoveBlock({
  codeContainerRef,
  centerBlock,
  lineHeight,
  fontSize,
  theme,
  language,
  highlighter,
  code,
  transition,
  stagger,
  showLineNumbers,
}: {
  codeContainerRef: React.RefObject<HTMLDivElement | null>;
  centerBlock: boolean;
  lineHeight: number;
  fontSize: number;
  theme: string;
  language: string;
  highlighter: Highlighter;
  code: string;
  transition: number;
  stagger: number;
  showLineNumbers: boolean;
}) {
  return (
    <div
      ref={codeContainerRef}
      className={cn(centerBlock ? "w-max max-w-full" : "w-full")}
      style={{
        "--line-height": lineHeight.toString(),
        "--font-size": `${fontSize.toFixed(1)}px`,
      } as React.CSSProperties}
    >
      <ShikiMagicMove
        key={`${theme}-${language}`}
        lang={language}
        theme={theme}
        highlighter={highlighter}
        code={code}
        options={{ duration: transition, stagger, lineNumbers: showLineNumbers }}
        className="shiki-magic-move-container font-mono font-medium tracking-wide"
      />
    </div>
  );
});
