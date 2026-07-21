import { useEffect, useState } from "react";
import { Timer } from "lucide-react";
import { formatClockSeconds } from "@/lib/utils";
import { Chip } from "../ui/chip";

function useRemainingSec(duration: number, resetKey: string) {
  const [remaining, setRemaining] = useState(() => Math.ceil(duration / 1000));
  useEffect(() => {
    const start = performance.now();
    setRemaining(Math.ceil(duration / 1000));
    const id = window.setInterval(() => {
      const next = Math.max(0, Math.ceil((duration - (performance.now() - start)) / 1000));
      setRemaining((prev) => prev === next ? prev : next);
    }, 100);
    return () => window.clearInterval(id);
  }, [duration, resetKey]);
  return remaining;
}

interface AutoplayTimerChipProps {
  duration: number;
  resetKey: string;
}

export function AutoplayTimerChip({ duration, resetKey }: AutoplayTimerChipProps) {
  const remaining = useRemainingSec(duration, resetKey);
  return (
    <Chip>
      <Timer className="h-3 w-3" />
      <span className="font-mono tabular-nums">{formatClockSeconds(remaining)}</span>
      <span className="text-white/40">/ {Math.ceil(duration / 1000)}s</span>
    </Chip>
  );
}
