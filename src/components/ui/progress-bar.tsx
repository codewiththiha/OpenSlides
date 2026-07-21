import { cn } from "@/lib/utils";

interface ProgressBarProps {
  duration: number;
  resetKey: string;
  className?: string;
  style?: React.CSSProperties;
}

export function ProgressBar({
  duration,
  resetKey,
  className,
  style,
}: ProgressBarProps) {
  return (
    <div className={cn("overflow-hidden", className)} style={style}>
      <div
        key={resetKey}
        className="openslides-progress-anim h-full w-full origin-left bg-primary"
        style={{
          animation: `openslides-present-progress ${duration}ms linear forwards`,
        }}
      />
    </div>
  );
}
