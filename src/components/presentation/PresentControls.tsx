import { Pause, Play } from "lucide-react";
import { Kbd } from "../ui/kbd";

interface PresentControlsProps {
  isAutoPlaying: boolean;
  onToggleAutoplay: () => void;
  onExit: () => void;
}

export function PresentControls({
  isAutoPlaying,
  onToggleAutoplay,
  onExit,
}: PresentControlsProps) {
  return (
    <>
      <button
        type="button"
        className="flex items-center gap-2 rounded-md bg-white/10 px-3 py-1.5 text-sm text-white/70 transition hover:bg-white/20 hover:text-white"
        onClick={onToggleAutoplay}
        title={isAutoPlaying ? "Pause autoplay" : "Play (auto-advance)"}
      >
        {isAutoPlaying ? (
          <Pause className="h-3.5 w-3.5" />
        ) : (
          <Play className="h-3.5 w-3.5" />
        )}
        <span className="hidden sm:inline">
          {isAutoPlaying ? "Pause" : "Play"}
        </span>
      </button>
      <button
        type="button"
        className="flex items-center gap-2 rounded-md bg-white/10 px-3 py-1.5 text-sm text-white/70 transition hover:bg-white/20 hover:text-white"
        onClick={onExit}
      >
        Press{" "}
        <Kbd tone="onDark" className="px-2 text-xs">
          ESC
        </Kbd>{" "}
        to exit
      </button>
    </>
  );
}
