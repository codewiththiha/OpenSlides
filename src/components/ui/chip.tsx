import { cn } from "@/lib/utils";

interface ChipProps extends React.HTMLAttributes<HTMLSpanElement> {}

export function Chip({ className, ...props }: ChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md bg-black/60 px-2.5 py-1 text-xs text-white/80 backdrop-blur",
        className,
      )}
      {...props}
    />
  );
}
